import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Emitter, type Event } from '@nanoforge-dev/editor-kernel';
import type { GameServerState, RuntimeEvent } from '@nanoforge-dev/editor-protocol';

/**
 * Runs in the game process (Bun): receives the entry point, files and env over IPC, then
 * starts the game with an editor bridge whose `toEditor` events are sent back over IPC.
 */
const RUNNER_SOURCE = `import { pathToFileURL } from 'node:url';

class QueuedEmitter {
  listeners = new Map();
  queue = [];
  on(event, listener) { this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]); }
  off(event, listener) { this.listeners.set(event, (this.listeners.get(event) ?? []).filter((l) => l !== listener)); }
  emit(event, ...args) { this.queue.push([event, args]); }
  runEvents() {
    for (const [event, args] of this.queue.splice(0)) {
      for (const listener of this.listeners.get(event) ?? []) {
        try { listener(...args); } catch (error) { console.error(error); }
      }
    }
  }
}

const send = (message) => { if (process.connected) process.send(message); };
const fromEditor = new QueuedEmitter();
const toEditor = {
  on() {}, off() {}, runEvents() {},
  emit(event, ...args) {
    send({ type: 'bridge', event, args });
    if (event === 'state' && args[0] === 'stopped') setTimeout(() => process.exit(0), 50);
  },
};

process.on('message', async (message) => {
  if (message.type === 'command') return fromEditor.emit(message.event, ...message.args);
  if (message.type !== 'init') return;
  try {
    const { main } = await import(pathToFileURL(message.main).href);
    console.log('Starting server');
    await main({ files: new Map(Object.entries(message.files)), env: message.env, editor: { toEditor, fromEditor } });
    send({ type: 'started' });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
});
process.on('disconnect', () => process.exit(0));
send({ type: 'ready' });
`;

const runners = new Map<string, Promise<string>>();

/** Writes the runner script once per data directory (the server itself may be bundled). */
const ensureRunner = (dataDir: string): Promise<string> => {
  let runner = runners.get(dataDir);
  if (!runner) {
    runner = (async () => {
      const dir = join(dataDir, 'runtime');
      await mkdir(dir, { recursive: true });
      const path = join(dir, 'game-server-runner.mjs');
      await writeFile(path, RUNNER_SOURCE);
      return path;
    })();
    runners.set(dataDir, runner);
  }
  return runner;
};

export interface GameServerOptions {
  readonly app: string;
  /** Directory the game runs in (the app root). */
  readonly cwd: string;
  readonly main: string;
  /** Virtual path (`/libecs.wasm`) → absolute path. */
  readonly files: Record<string, string>;
  readonly env: Record<string, string>;
  readonly dataDir: string;
  /** Grace period for a requested stop before the process is killed. */
  readonly stopTimeoutMs?: number;
  readonly bunPath?: string;
}

type RunnerMessage =
  | { type: 'ready' }
  /** `main` resolved: the game runs, whether or not its engine speaks the bridge. */
  | { type: 'started' }
  | { type: 'bridge'; event: string; args: unknown[] };

/**
 * A game server process started by the editor. `stop` asks the game to stop through the
 * bridge, then kills the whole process group if it did not exit in time.
 */
export class GameServerProcess {
  private readonly _onEvent = new Emitter<RuntimeEvent>();
  private _child: ChildProcess | undefined;
  private _state: GameServerState = 'starting';
  private _bridge = false;
  private _exited: Promise<number | null> = Promise.resolve(null);

  readonly onEvent: Event<RuntimeEvent> = this._onEvent.event;

  constructor(private readonly _options: GameServerOptions) {}

  get state(): GameServerState {
    return this._state;
  }

  /** Whether the game answered with the editor bridge hello. */
  get bridged(): boolean {
    return this._bridge;
  }

  async start(): Promise<void> {
    const runner = await ensureRunner(this._options.dataDir);
    const bun = this._options.bunPath ?? (process.versions.bun ? process.execPath : 'bun');
    const child = spawn(bun, [runner], {
      cwd: this._options.cwd,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      detached: process.platform !== 'win32',
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    this._child = child;
    this._setState('starting');
    for (const stream of ['stdout', 'stderr'] as const) {
      let pending = '';
      child[stream]?.on('data', (chunk: Buffer) => {
        const lines = (pending + chunk.toString('utf8')).split(/\r?\n/);
        pending = lines.pop() ?? '';
        for (const text of lines) this._log(stream, text);
      });
      child[stream]?.on('end', () => pending && this._log(stream, pending));
    }
    child.on('message', (message: RunnerMessage) => this._onMessage(message));
    this._exited = new Promise((resolve) => {
      child.on('error', (error) => {
        this._log('stderr', `Could not start the game server: ${error.message}`);
        this._setState('exited', null);
        resolve(null);
      });
      child.on('exit', (code) => {
        this._setState('exited', code);
        resolve(code);
      });
    });
  }

  /** Kills the process group at once (editor shutdown). */
  kill(): void {
    this._kill('SIGKILL');
  }

  /** Sends an editor → engine event (`fromEditor`). */
  send(event: string, args: readonly unknown[] = []): void {
    if (this._child?.connected) this._child.send({ type: 'command', event, args });
  }

  /** Stops the game and resolves once the process exited. */
  async stop(): Promise<void> {
    const child = this._child;
    if (!child || this._state === 'exited') return;
    this._setState('stopping');
    if (this._bridge) this.send('stop');
    else this._kill('SIGTERM');
    const timeout = this._options.stopTimeoutMs ?? 5000;
    if (await this._exitWithin(timeout)) return;
    this._kill('SIGTERM');
    if (await this._exitWithin(2000)) return;
    this._kill('SIGKILL');
    await this._exited;
  }

  private async _exitWithin(ms: number): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<false>(
      (resolve) => (timer = setTimeout(() => resolve(false), ms)),
    );
    const exited = this._exited.then(() => true as const);
    const result = await Promise.race([exited, timedOut]);
    clearTimeout(timer);
    return result;
  }

  private _kill(signal: NodeJS.Signals): void {
    const child = this._child;
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
    try {
      if (process.platform === 'win32') child.kill(signal);
      else process.kill(-child.pid, signal);
    } catch {
      child.kill(signal);
    }
  }

  private _onMessage(message: RunnerMessage): void {
    if (message.type === 'ready') {
      this._child?.send({
        type: 'init',
        main: this._options.main,
        files: this._options.files,
        env: this._options.env,
      });
      return;
    }
    if (message.type === 'started') {
      if (this._state === 'starting') this._setState('running');
      return;
    }
    if (message.type !== 'bridge') return;
    if (message.event === 'hello') this._bridge = true;
    if (message.event === 'state' && this._state !== 'stopping') {
      if (message.args[0] === 'running') this._setState('running');
      else if (message.args[0] === 'paused') this._setState('paused');
    }
    this._onEvent.fire({
      type: 'bridge',
      app: this._options.app,
      event: message.event,
      args: message.args,
    });
  }

  private _setState(state: GameServerState, exitCode?: number | null): void {
    if (this._state === state && state !== 'starting') return;
    if (this._state === 'exited' && state !== 'starting') return;
    this._state = state;
    this._onEvent.fire({
      type: 'server',
      app: this._options.app,
      state,
      ...(exitCode !== undefined && { exitCode }),
    });
  }

  private _log(stream: 'stdout' | 'stderr', text: string): void {
    this._onEvent.fire({ type: 'log', app: this._options.app, source: 'server', stream, text });
  }
}
