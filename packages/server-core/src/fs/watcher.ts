import { watch } from 'chokidar';
import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';

import { Emitter, type Event } from '@nanoforge-dev/editor-kernel';
import type { FileChange } from '@nanoforge-dev/editor-protocol';

import type { PathJail } from './path-jail';

export const DEFAULT_IGNORED_SEGMENTS = [
  'node_modules',
  '.git',
  '.turbo',
  'coverage',
  '.svelte-kit',
];

/**
 * Folders the editor writes for itself: the trash, and the meta cache (written while the user
 * types; the client that writes it already knows).
 */
const EDITOR_OWN = ['.nanoforge/editor/trash', '.nanoforge/editor/cache'];

/**
 * Temporary names (`<name>.nf-<hex>`): atomic write files, and the folder a package reinstall
 * moves aside (`writeFolder`), with everything in it.
 */
const TEMP_SEGMENT = /\.nf-[0-9a-f]{8}$/;

export interface WatcherOptions {
  /** Project-relative directories to ignore besides the defaults (build outputs…). */
  ignoredPaths?: () => readonly string[];
  /** Paths hidden from the editor (`.nfignore`), checked for each change. */
  isIgnored?: (path: string, directory: boolean) => boolean;
  batchMs?: number;
}

/**
 * Watches a project and emits batched changes (default every 50 ms). Consecutive events on the
 * same path collapse (`created` then `deleted` in the same batch cancel out).
 */
export class ProjectWatcher {
  private readonly _onDidChange = new Emitter<FileChange[]>({
    onFirstListenerAdd: () => this._start(),
    onLastListenerRemove: () => void this._stop(),
  });
  private _watcher: ReturnType<typeof watch> | undefined;
  private _pending = new Map<string, FileChange>();
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _ready: Promise<void> = Promise.resolve();
  private _realRoot: string | undefined;

  /** Starts watching on the first listener and stops with the last one. */
  readonly onDidChange: Event<FileChange[]> = this._onDidChange.event;

  constructor(
    private readonly _jail: PathJail,
    private readonly _options: WatcherOptions = {},
  ) {}

  /** Resolves once the initial scan is done (tests, first subscription). */
  get ready(): Promise<void> {
    return this._ready;
  }

  dispose(): void {
    this._onDidChange.dispose();
    void this._stop();
  }

  private _ignored = (absolute: string): boolean => {
    const rel = this._jail.relative(absolute);
    if (!rel || rel.startsWith('..')) return false;
    const segments = rel.split('/');
    if (segments.some((segment) => DEFAULT_IGNORED_SEGMENTS.includes(segment))) return true;
    if (this._leavesProject(absolute)) return true;
    if (EDITOR_OWN.some((folder) => rel === folder || rel.startsWith(`${folder}/`))) return true;
    if (segments.some((segment) => TEMP_SEGMENT.test(segment))) return true;
    return (this._options.ignoredPaths?.() ?? []).some(
      (path) => rel === path || rel.startsWith(`${path}/`),
    );
  };

  /**
   * A link that leads outside of the project (a committed `link -> /`): never watched, or the
   * watcher would crawl the host and stream outside file names to the client. Links are still
   * followed otherwise (`followSymlinks: false` makes chokidar miss files in new folders).
   */
  private _leavesProject(absolute: string): boolean {
    try {
      if (!lstatSync(absolute).isSymbolicLink()) return false;
      this._realRoot ??= realpathSync(this._jail.root);
      const rel = relative(this._realRoot, realpathSync(absolute));
      return rel.startsWith('..') || isAbsolute(rel);
    } catch {
      return false;
    }
  }

  private _start(): void {
    const watcher = watch(this._jail.root, {
      ignoreInitial: true,
      ignored: this._ignored,
      awaitWriteFinish: false,
      atomic: true,
    });
    this._watcher = watcher;
    this._ready = new Promise((resolve) => watcher.once('ready', () => resolve()));
    const push = (type: FileChange['type'], kind: FileChange['kind']) => (absolute: string) =>
      this._queue({ type, kind, path: this._jail.relative(absolute) });
    watcher
      .on('add', push('created', 'file'))
      .on('addDir', push('created', 'directory'))
      .on('change', push('changed', 'file'))
      .on('unlink', push('deleted', 'file'))
      .on('unlinkDir', push('deleted', 'directory'));
  }

  private async _stop(): Promise<void> {
    clearTimeout(this._timer);
    this._pending.clear();
    const watcher = this._watcher;
    this._watcher = undefined;
    await watcher?.close();
  }

  private _queue(change: FileChange): void {
    if (this._options.isIgnored?.(change.path, change.kind === 'directory')) return;
    const previous = this._pending.get(change.path);
    if (previous?.type === 'created' && change.type === 'deleted') {
      this._pending.delete(change.path);
    } else if (previous?.type === 'deleted' && change.type === 'created') {
      this._pending.set(change.path, { ...change, type: 'changed' });
    } else if (previous?.type !== 'created' || change.type !== 'changed') {
      this._pending.set(change.path, change);
    }
    this._timer ??= setTimeout(() => this._flush(), this._options.batchMs ?? 50);
  }

  private _flush(): void {
    this._timer = undefined;
    const changes = [...this._pending.values()];
    this._pending.clear();
    if (changes.length) this._onDidChange.fire(changes);
  }
}
