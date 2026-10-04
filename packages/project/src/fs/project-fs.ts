import {
  type Disposable,
  DisposableStore,
  Emitter,
  type Event,
  type Observable,
  ObservableValue,
} from '@nanoforge-dev/editor-kernel';
import {
  type FileChange,
  type FileContent,
  type FileEntry,
  FsContract,
} from '@nanoforge-dev/editor-protocol';
import type { RpcApi, RpcClient } from '@nanoforge-dev/editor-rpc';

import type { ContentCache, TreeCache } from '../cache/cache.type';

const decoder = new TextDecoder();

/** Hides files from the whole editor (see the server's file system). */
export const NFIGNORE_FILE = '.nfignore';

export interface WriteOptions {
  /** Fails with CONFLICT if the file changed since this hash (null = must not exist). */
  expectedHash?: string | null;
}

/**
 * Files of the open project. The tree is loaded once (cached for fast startup), then kept in
 * sync by the server change stream, so contents can be served from the local cache whenever
 * the cached copy is as recent as the tree says.
 */
export class ProjectFs implements Disposable {
  private readonly _fs: RpcApi<typeof FsContract>;
  private readonly _tree = new Map<string, FileEntry>();
  private readonly _ready = new ObservableValue(false);
  private readonly _onDidChange = new Emitter<readonly FileChange[]>();
  private readonly _store = new DisposableStore();

  /** Batched changes (from the server watcher and this client's own writes). */
  readonly onDidChange: Event<readonly FileChange[]> = this._onDidChange.event;

  constructor(
    readonly projectId: string,
    private readonly _rpc: RpcClient,
    private readonly _contents: ContentCache,
    private readonly _treeCache: TreeCache,
  ) {
    this._fs = _rpc.api(FsContract);
  }

  /** True once the tree was fetched from the server (cached trees may be stale before). */
  get ready(): Observable<boolean> {
    return this._ready.readonly();
  }

  /** Loads the cached tree, subscribes to changes, then revalidates against the server. */
  async initialize(): Promise<void> {
    const cached = await this._treeCache.load();
    for (const entry of cached ?? []) this._tree.set(entry.path, entry);
    this._store.add(
      this._rpc.subscribe(
        FsContract,
        'changes',
        { project: this.projectId },
        ({ changes }) => void this._applyRemote(changes),
      ),
    );
    this._store.add(this._rpc.onDidReconnect(() => void this.refresh().catch(() => undefined)));
    await this.refresh();
  }

  /** Re-fetches the whole tree and reports the differences as changes. */
  async refresh(): Promise<void> {
    const entries = await this._fs.list({ project: this.projectId, path: '', recursive: true });
    const next = new Map(entries.map((entry) => [entry.path, entry]));
    const changes: FileChange[] = [];
    for (const [path, entry] of next) {
      const previous = this._tree.get(path);
      if (!previous) changes.push({ type: 'created', path, kind: entry.kind });
      else if (previous.mtime !== entry.mtime || previous.size !== entry.size) {
        changes.push({ type: 'changed', path, kind: entry.kind });
      }
    }
    for (const [path, entry] of this._tree) {
      if (!next.has(path)) changes.push({ type: 'deleted', path, kind: entry.kind });
    }
    this._tree.clear();
    for (const [path, entry] of next) this._tree.set(path, entry);
    this._ready.set(true);
    await this._treeCache.save(entries);
    for (const change of changes)
      if (change.type === 'deleted') await this._contents.delete(change.path);
    if (changes.length) this._onDidChange.fire(changes);
  }

  /** Last known entry (synchronous, from the tree). */
  entry(path: string): FileEntry | undefined {
    return this._tree.get(path);
  }

  /** Direct children of a directory, from the tree. */
  children(path: string): FileEntry[] {
    const prefix = path ? `${path}/` : '';
    return [...this._tree.values()]
      .filter(
        (entry) =>
          entry.path.startsWith(prefix) &&
          !entry.path.slice(prefix.length).includes('/') &&
          entry.path !== path,
      )
      .sort((a, b) =>
        a.kind === b.kind ? a.path.localeCompare(b.path) : a.kind === 'directory' ? -1 : 1,
      );
  }

  get entries(): readonly FileEntry[] {
    return [...this._tree.values()];
  }

  /**
   * `fresh` asks the server even when the cached content looks current: the tree only learns
   * of a change on disk when the watcher reports it.
   */
  async read(path: string, options: { fresh?: boolean } = {}): Promise<FileContent> {
    const known = this._tree.get(path);
    const cached = !options.fresh && known && (await this._contents.get(path));
    if (known && cached && cached.mtime === known.mtime && cached.content.length === known.size) {
      return { ...known, content: cached.content, hash: cached.hash };
    }
    const file = await this._fs.read({ project: this.projectId, path });
    this._tree.set(path, { path, kind: 'file', size: file.size, mtime: file.mtime });
    await this._contents.set(path, { content: file.content, mtime: file.mtime, hash: file.hash });
    return file;
  }

  async readText(
    path: string,
    options: { fresh?: boolean } = {},
  ): Promise<{ text: string; hash: string; mtime: number }> {
    const file = await this.read(path, options);
    return { text: decoder.decode(file.content), hash: file.hash, mtime: file.mtime };
  }

  async write(
    path: string,
    content: Uint8Array | string,
    options: WriteOptions = {},
  ): Promise<FileEntry & { hash: string }> {
    const result = await this._fs.write({
      project: this.projectId,
      path,
      content,
      ...(options.expectedHash !== undefined && { expectedHash: options.expectedHash }),
    });
    const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    const existed = this._tree.has(path);
    this._tree.set(path, { path, kind: 'file', size: result.size, mtime: result.mtime });
    await this._contents.set(path, { content: bytes, mtime: result.mtime, hash: result.hash });
    this._onDidChange.fire([{ type: existed ? 'changed' : 'created', path, kind: 'file' }]);
    return result;
  }

  async mkdir(path: string): Promise<void> {
    const entry = await this._fs.mkdir({ project: this.projectId, path });
    this._tree.set(path, entry);
  }

  async rename(from: string, to: string, overwrite = false): Promise<void> {
    await this._fs.rename({ project: this.projectId, from, to, overwrite });
    await this.refresh();
  }

  async copy(from: string, to: string, overwrite = false): Promise<void> {
    await this._fs.copy({ project: this.projectId, from, to, overwrite });
    await this.refresh();
  }

  /** Moves the entry to the project trash; resolves with its place there (for `restore`). */
  async delete(path: string): Promise<{ trashPath: string }> {
    const kind = this.entry(path)?.kind ?? 'file';
    const result = await this._fs.delete({ project: this.projectId, path });
    this._removeFromTree(path);
    await this._contents.delete(path);
    this._onDidChange.fire([{ type: 'deleted', path, kind }]);
    return result;
  }

  /** Undo of `delete`: brings the entry back from the trash. */
  async restore(trashPath: string, path: string): Promise<void> {
    await this._fs.restore({ project: this.projectId, trashPath, path });
    await this.refresh();
  }

  /** Local editors: shows the entry in the OS file manager. */
  async reveal(path: string): Promise<void> {
    await this._fs.reveal({ project: this.projectId, path });
  }

  dispose(): void {
    this._store.dispose();
    this._onDidChange.dispose();
  }

  private async _applyRemote(changes: readonly FileChange[]): Promise<void> {
    const relevant: FileChange[] = [];
    for (const change of changes) {
      if (change.type === 'deleted') {
        this._removeFromTree(change.path);
        await this._contents.delete(change.path);
        relevant.push(change);
        continue;
      }
      const entry = await this._fs
        .stat({ project: this.projectId, path: change.path })
        .catch(() => null);
      if (!entry) continue;
      const previous = this._tree.get(change.path);
      this._tree.set(change.path, entry);
      if (previous && previous.mtime === entry.mtime && previous.size === entry.size) continue;
      relevant.push(change);
    }
    if (relevant.length) this._onDidChange.fire(relevant);
    if (changes.some((change) => change.path === NFIGNORE_FILE)) await this.refresh();
  }

  private _removeFromTree(path: string): void {
    for (const key of [...this._tree.keys()]) {
      if (key === path || key.startsWith(`${path}/`)) this._tree.delete(key);
    }
  }
}
