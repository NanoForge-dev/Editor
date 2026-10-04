import { serializeLogValue } from '@nanoforge-dev/editor-kernel';
import type { OutputManifest } from '@nanoforge-dev/editor-protocol';

import { DirectEmitter } from '../bridge/direct-emitter';
import { QueuedEmitter } from '../bridge/queued-emitter';
import type { ClientRunTarget, ClientRunnerOptions } from './game-client-runner.type';

let runs = 0;

/** Files of a build as the loader gives them to the game: `/path` → versioned URL. */
export const clientFiles = (manifest: OutputManifest, origin: string): Map<string, string> =>
  new Map(
    manifest.files.map((file) => [
      `/${file.path}`,
      `${origin}${manifest.baseUrl}${file.path}?v=${file.hash}`,
    ]),
  );

/**
 * Runs a built client in the editor page. Every run imports a fresh module instance (module
 * state never leaks between runs) into its own container, which is removed on stop.
 */
export class GameClientRunner {
  private readonly _fromEditor = new QueuedEmitter();
  private _mount: HTMLDivElement | undefined;
  private _bridged = false;
  private _stopped = false;
  private _stopWaiters: (() => void)[] = [];
  private _removeErrorListeners: (() => void) | undefined;

  constructor(private readonly _options: ClientRunnerOptions) {}

  /** Whether the game answered with the editor bridge hello. */
  get bridged(): boolean {
    return this._bridged;
  }

  /** Imports and starts the game; resolves when its `main` resolved. */
  async start(target: ClientRunTarget): Promise<void> {
    const { manifest, origin } = target;
    const baseUrl = `${origin}${manifest.baseUrl}`;
    const mount = target.host.ownerDocument.createElement('div');
    mount.dataset.nfGame = manifest.app;
    mount.style.cssText = 'position:absolute;inset:0;overflow:hidden';
    target.host.append(mount);
    this._mount = mount;
    this._watchErrors(baseUrl);

    const entry = manifest.files.find((file) => file.path === manifest.entry);
    const url = `${baseUrl}${manifest.entry}?v=${entry?.hash ?? manifest.version}&run=${++runs}`;
    const module = await this._options.importModule(url);
    if (typeof module.main !== 'function') throw new Error(`${manifest.entry} exports no main`);
    const toEditor = new DirectEmitter((event, args) => this._onEngineEvent(event, args));
    await module.main({
      container: mount,
      files: clientFiles(manifest, origin),
      env: target.env,
      editor: {
        toEditor,
        fromEditor: this._fromEditor,
        serializeLogValue: (value) => serializeLogValue(value),
      },
    });
  }

  send(event: string, args: readonly unknown[] = []): void {
    this._fromEditor.emit(event, ...args);
  }

  /**
   * Asks the game to stop and waits for its `stopped` state (libraries cleared), then removes
   * its container. Returns false when the game did not stop in time (it may still be running).
   */
  async stop(timeoutMs = 3000): Promise<boolean> {
    let clean = this._stopped;
    if (!clean && this._bridged) {
      this.send('stop');
      clean = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), timeoutMs);
        this._stopWaiters.push(() => {
          clearTimeout(timer);
          resolve(true);
        });
      });
    }
    this._mount?.remove();
    this._mount = undefined;
    this._removeErrorListeners?.();
    this._removeErrorListeners = undefined;
    return clean;
  }

  private _onEngineEvent(event: string, args: unknown[]): void {
    if (event === 'hello') this._bridged = true;
    if (event === 'state' && args[0] === 'stopped') {
      this._stopped = true;
      for (const waiter of this._stopWaiters.splice(0)) waiter();
    }
    this._options.onEvent(event, args);
  }

  /** Reports uncaught errors whose stack points into the game bundle. */
  private _watchErrors(baseUrl: string): void {
    const target =
      this._options.errorTarget ??
      ('addEventListener' in globalThis ? (globalThis as unknown as Window) : undefined);
    if (!target) return;
    const fromGame = (error: unknown, filename?: string) =>
      filename?.startsWith(baseUrl) ||
      (error instanceof Error && (error.stack ?? '').includes(baseUrl));
    const onError = (event: Event) => {
      const { error, filename } = event as ErrorEvent;
      if (fromGame(error, filename)) this._options.onError(error ?? (event as ErrorEvent).message);
    };
    const onRejection = (event: Event) => {
      const { reason } = event as PromiseRejectionEvent;
      if (fromGame(reason)) this._options.onError(reason);
    };
    target.addEventListener('error', onError);
    target.addEventListener('unhandledrejection', onRejection);
    this._removeErrorListeners = () => {
      target.removeEventListener('error', onError);
      target.removeEventListener('unhandledrejection', onRejection);
    };
  }
}
