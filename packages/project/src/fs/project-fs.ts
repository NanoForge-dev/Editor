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
import { type RpcApi, type RpcClient, RpcError } from '@nanoforge-dev/editor-rpc';

import type { ContentCache, TreeCache } from '../cache/cache.type';
import { sha1Hex } from '../cache/sha1';

const decoder = new TextDecoder();

/** Hides files from the whole editor (see the server's file system). */
export const NFIGNORE_FILE = '.nfignore';

export interface WriteOptions {
  /** Fails with CONFLICT if the file changed since this hash (null = must not exist). */
  expectedHash?: string | null;
}

/** Whether two entries hold the same content (by hash when both have one). */
const sameContent = (a: FileEntry, b: FileEntry): boolean =>
  a.hash && b.hash ? a.hash === b.hash : a.mtime === b.mtime && a.size === b.size;

/**
 * Files of the open project. The tree is loaded once (cached for fast startup), then kept in
 * sync by the server change stream. Contents come from the local cache, keyed by the hash the
 * tree gives each file: a copy is served when its hash is the tree's, whatever the dates say,
 * and a renamed or copied file is already there.
 */
export class ProjectFs implements Disposable {
  private readonly _fs: RpcApi<typeof FsContract>;
  private readonly _tree = new Map<string, FileEntry>();
  private readonly _ready = new ObservableValue(false);
  private readonly _onDidChange = new Emitter<readonly FileChange[]>();
  private readonly _store = new DisposableStore();
  private _treeSave: ReturnType<typeof setTimeout> | undefined;

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
      else if (entry.kind === 'file' && !sameContent(previous, entry)) {
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
   * of a change on disk when the watcher reports it. The server then sends the bytes only if the
   * cached copy is out of date.
   */
  async read(path: string, options: { fresh?: boolean } = {}): Promise<FileContent> {
    const [result] = await this._fetch([path], options.fresh ?? false);
    if (!result || 'error' in result)
      throw new RpcError(
        (result?.error.code ?? 'INTERNAL') as RpcError['code'],
        result?.error.message ?? `Could not read ${path}`,
      );
    return result;
  }

  /**
   * Reads several files at once (a project opening, open tabs, type information): the ones the
   * cache has cost nothing, the others come in a few batched requests. Unreadable files are left
   * out.
   */
  async readMany(paths: readonly string[]): Promise<Map<string, FileContent>> {
    const results = await this._fetch(paths, false);
    return new Map(
      results.flatMap((result) => ('error' in result ? [] : [[result.path, result] as const])),
    );
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
    this._tree.set(path, {
      path,
      kind: 'file',
      size: result.size,
      mtime: result.mtime,
      hash: result.hash,
    });
    /** Kept only if the server wrote exactly these bytes: the cache must never lie. */
    if ((await sha1Hex(bytes).catch(() => undefined)) === result.hash)
      await this._contents.set(result.hash, bytes).catch(() => undefined);
    this._scheduleTreeSave();
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
    this._scheduleTreeSave();
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
    if (this._treeSave) {
      clearTimeout(this._treeSave);
      void this._treeCache.save([...this._tree.values()]);
    }
    this._store.dispose();
    this._onDidChange.dispose();
  }

  private async _applyRemote(changes: readonly FileChange[]): Promise<void> {
    const relevant: FileChange[] = [];
    for (const change of changes) {
      if (change.type === 'deleted') {
        this._removeFromTree(change.path);
        relevant.push(change);
        continue;
      }
      const entry = await this._fs
        .stat({ project: this.projectId, path: change.path })
        .catch(() => null);
      if (!entry) continue;
      const previous = this._tree.get(change.path);
      this._tree.set(change.path, entry);
      if (previous && entry.kind === 'file' && sameContent(previous, entry)) continue;
      relevant.push(change);
    }
    this._scheduleTreeSave();
    if (relevant.length) this._onDidChange.fire(relevant);
    if (changes.some((change) => change.path === NFIGNORE_FILE)) await this.refresh();
  }

  /**
   * Contents of files: from the cache when the tree's hash is there (unless `fresh`), else from
   * the server, which answers `notModified` for a cached copy still current.
   */
  private async _fetch(
    paths: readonly string[],
    fresh: boolean,
  ): Promise<(FileContent | { path: string; error: { code: string; message: string } })[]> {
    const found = new Map<string, FileContent>();
    const cached = new Map<string, Uint8Array>();
    const ask: { path: string; knownHash?: string }[] = [];
    /** Cache lookups run together: each one is a read of the browser's storage. */
    const lookups = await Promise.all(
      paths.map(async (path) => {
        const known = this._tree.get(path);
        const bytes = known?.hash ? await this._contents.get(known.hash) : undefined;
        return { path, known, bytes };
      }),
    );
    for (const { path, known, bytes } of lookups) {
      if (known?.hash && bytes) {
        if (!fresh) {
          found.set(path, { ...known, content: bytes, hash: known.hash });
          continue;
        }
        cached.set(path, bytes);
        ask.push({ path, knownHash: known.hash });
      } else ask.push({ path });
    }
    const errors = new Map<string, { code: string; message: string }>();
    /** Chunks of 64 files, 4 requests at a time, like reads one by one would overlap. */
    const chunks: (typeof ask)[] = [];
    for (let start = 0; start < ask.length; start += 64) chunks.push(ask.slice(start, start + 64));
    const readChunk = async (chunk: typeof ask) => {
      let pending = chunk;
      while (pending.length) {
        const answer = await this._fs.readMany({ project: this.projectId, files: pending });
        for (const result of answer.files) {
          if ('error' in result) {
            errors.set(result.path, result.error);
            continue;
          }
          const entry: FileEntry = {
            path: result.path,
            kind: 'file',
            size: result.size,
            mtime: result.mtime,
            hash: result.hash,
          };
          this._tree.set(result.path, entry);
          if ('notModified' in result) {
            const bytes = cached.get(result.path);
            if (bytes) found.set(result.path, { ...entry, content: bytes, hash: result.hash });
            continue;
          }
          found.set(result.path, result);
          /** Stored in the background: the bytes are already here, and the disk is slow. */
          void this._contents.set(result.hash, result.content).catch(() => undefined);
        }
        const rest = new Set(answer.rest);
        pending = pending.filter((file) => rest.has(file.path));
      }
    };
    const queue = [...chunks];
    const worker = async () => {
      for (let chunk = queue.shift(); chunk; chunk = queue.shift()) await readChunk(chunk);
    };
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
    if (ask.length) this._scheduleTreeSave();
    return paths.map(
      (path) =>
        found.get(path) ?? {
          path,
          error: errors.get(path) ?? { code: 'NOT_FOUND', message: `Could not read ${path}` },
        },
    );
  }

  /**
   * Saves the tree a moment after it changed in this session (writes, remote changes, reads):
   * the cache's upkeep reads the saved trees to know which contents projects still use.
   */
  private _scheduleTreeSave(): void {
    clearTimeout(this._treeSave);
    this._treeSave = setTimeout(() => {
      this._treeSave = undefined;
      void this._treeCache.save([...this._tree.values()]);
    }, 1000);
  }

  private _removeFromTree(path: string): void {
    for (const key of [...this._tree.keys()]) {
      if (key === path || key.startsWith(`${path}/`)) this._tree.delete(key);
    }
  }
}
