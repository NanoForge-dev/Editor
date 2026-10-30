import { type Disposable, createToken } from '@nanoforge-dev/editor-kernel';
import type { FileEntry } from '@nanoforge-dev/editor-protocol';

import type { CacheFactory } from '../service/client-project';
import {
  BLOBS,
  type BlobRecord,
  PROJECTS,
  type ProjectRecord,
  TREES,
  blobKey,
  keysWithPrefix,
  projectKey,
  transact,
  valuesWithPrefix,
} from './cache-db';
import type { ContentCache, TreeCache } from './cache.type';
import { IndexedDbTreeCache } from './indexed-db.tree-cache';
import { type OpfsContentCache } from './opfs.content-cache';

const DAY_MS = 24 * 60 * 60 * 1000;
/** A content written or read this recently is never swept: another tab may be about to use it. */
const RECENT_MS = 10 * 60 * 1000;
/** Last-use times are written at most this often. */
const TOUCH_DELAY_MS = 60 * 1000;
/** Contents read or written lately, kept in memory too: a project opening reads them twice. */
const MEMORY_BYTES = 64 * 1024 * 1024;

export interface ProjectCachesOptions {
  /** Budget in bytes; the cache never takes more than a tenth of the browser's quota either. */
  readonly budgetBytes: () => number;
  /** Projects not opened for this many days are dropped (0 keeps them). */
  readonly maxAgeDays: () => number;
}

/** What the cache holds for a project. */
export interface ProjectUsage {
  readonly projectId: string;
  readonly bytes: number;
  readonly files: number;
  readonly opened: number;
}

export interface CacheUsage {
  readonly projects: readonly ProjectUsage[];
  /** Every content kept, counted once even when several projects have it. */
  readonly bytes: number;
  readonly budget: number;
  /** Whether the browser keeps this storage when space runs short (`navigator.storage.persist`). */
  readonly persisted: boolean;
}

/**
 * The browser caches of one user's projects: a content store shared by every project (by
 * sha1), each project's tree, and their upkeep. Contents beyond the budget go least recently
 * used first, projects not opened for a while are dropped, and contents no tree uses are swept.
 * Projects open in a tab hold a lock that keeps their contents.
 */
export class ProjectCaches implements CacheFactory {
  private readonly _touched = new Map<string, number>();
  private readonly _memory = new Map<string, Uint8Array>();
  private _memoryBytes = 0;
  /** Bytes written since the last upkeep: past a tenth of the budget, upkeep runs again. */
  private _writtenSinceSweep = 0;
  private _sweepTimer: ReturnType<typeof setTimeout> | undefined;
  private _touchTimer: ReturnType<typeof setTimeout> | undefined;
  /** The sweep making room after a full disk: every write waiting for room shares it. */
  private _roomSweep: Promise<void> | undefined;
  private readonly _contents: ContentCache;

  constructor(
    readonly user: string,
    private readonly _store: OpfsContentCache,
    private readonly _options: ProjectCachesOptions,
  ) {
    this._contents = {
      get: async (hash) => {
        const bytes = this._memory.get(hash) ?? (await this._store.get(hash));
        if (bytes) {
          this._touch(hash, bytes.length);
          this._remember(hash, bytes);
        }
        return bytes;
      },
      set: async (hash, content) => {
        this._remember(hash, content);
        await this._set(hash, content);
      },
    };
  }

  contents(): ContentCache {
    return this._contents;
  }

  tree(projectId: string): TreeCache {
    return new IndexedDbTreeCache(this.user, projectId);
  }

  /** Records that a project opened, and keeps its contents while the returned lease lives. */
  opened(projectId: string): Disposable {
    void transact(PROJECTS, 'readwrite', (transaction) =>
      transaction
        .objectStore(PROJECTS)
        .put(
          { user: this.user, projectId, opened: Date.now() } satisfies ProjectRecord,
          projectKey(this.user, projectId),
        ),
    ).catch(() => undefined);
    let release: () => void = () => undefined;
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks) {
      const held = new Promise<void>((resolve) => (release = resolve));
      void locks
        .request(this._projectLock(projectId), { mode: 'shared' }, () => held)
        .catch(() => undefined);
    }
    return { dispose: () => release() };
  }

  async usage(): Promise<CacheUsage> {
    await this._flushTouches();
    const [projects, trees, blobs, budget, persisted] = await Promise.all([
      valuesWithPrefix<ProjectRecord>(PROJECTS, `${this.user}\0`),
      this._trees(),
      valuesWithPrefix<BlobRecord>(BLOBS, `${this.user}\0`),
      this._budget(),
      navigator.storage?.persisted?.().catch(() => false) ?? Promise.resolve(false),
    ]);
    const sizes = new Map(blobs.map((blob) => [blob.hash, blob.size]));
    return {
      projects: projects.map((project) => {
        const hashes = new Set(
          (trees.get(project.projectId) ?? []).flatMap((entry) => entry.hash ?? []),
        );
        let bytes = 0;
        let files = 0;
        for (const hash of hashes) {
          const size = sizes.get(hash);
          if (size === undefined) continue;
          bytes += size;
          files++;
        }
        return { projectId: project.projectId, bytes, files, opened: project.opened };
      }),
      bytes: blobs.reduce((sum, blob) => sum + blob.size, 0),
      budget,
      persisted,
    };
  }

  /** Drops a project's tree, and the contents no other project uses. */
  async clearProject(projectId: string): Promise<void> {
    await transact([TREES, PROJECTS], 'readwrite', (transaction) => [
      transaction.objectStore(TREES).delete(projectKey(this.user, projectId)),
      transaction.objectStore(PROJECTS).delete(projectKey(this.user, projectId)),
    ]).catch(() => undefined);
    await this.sweep({ recentToo: true });
  }

  /** Drops everything this user has cached. */
  async clearAll(): Promise<void> {
    await this._exclusive(async () => {
      this._touched.clear();
      this._memory.clear();
      this._memoryBytes = 0;
      await this._store.clear();
      const prefix = `${this.user}\0`;
      for (const store of [TREES, BLOBS, PROJECTS]) {
        const keys = await keysWithPrefix(store, prefix).catch(() => []);
        await transact(store, 'readwrite', (transaction) =>
          keys.map((key) => transaction.objectStore(store).delete(key)),
        ).catch(() => undefined);
      }
    });
  }

  /**
   * Upkeep: drops projects not opened for `maxAgeDays`, the contents no tree uses, then the least
   * recently used contents of closed projects until `room` more bytes fit in the budget.
   */
  async sweep(options: { room?: number; recentToo?: boolean } = {}): Promise<void> {
    this._writtenSinceSweep = 0;
    clearTimeout(this._sweepTimer);
    this._sweepTimer = undefined;
    await this._exclusive(async () => {
      await this._flushTouches();
      const now = Date.now();
      const open = await this._openProjects();
      const maxAge = this._options.maxAgeDays();
      if (maxAge > 0) {
        const projects = await valuesWithPrefix<ProjectRecord>(PROJECTS, `${this.user}\0`);
        const expired = projects.filter(
          (project) => !open.has(project.projectId) && project.opened < now - maxAge * DAY_MS,
        );
        if (expired.length)
          await transact([TREES, PROJECTS], 'readwrite', (transaction) =>
            expired.flatMap((project) => [
              transaction.objectStore(TREES).delete(projectKey(this.user, project.projectId)),
              transaction.objectStore(PROJECTS).delete(projectKey(this.user, project.projectId)),
            ]),
          );
      }
      const trees = await this._trees();
      const used = new Set<string>();
      const kept = new Set<string>();
      for (const [projectId, entries] of trees)
        for (const entry of entries)
          if (entry.hash) {
            used.add(entry.hash);
            if (open.has(projectId)) kept.add(entry.hash);
          }
      const blobs = await valuesWithPrefix<BlobRecord>(BLOBS, `${this.user}\0`);
      const recent = (blob: BlobRecord) => !options.recentToo && blob.used > now - RECENT_MS;
      const gone = blobs.filter((blob) => !used.has(blob.hash) && !recent(blob));
      let total = blobs.reduce((sum, blob) => sum + blob.size, 0);
      for (const blob of gone) total -= blob.size;
      const budget = await this._budget();
      const target = budget - (options.room ?? 0);
      if (total > target) {
        const candidates = blobs
          .filter((blob) => used.has(blob.hash) && !kept.has(blob.hash) && !recent(blob))
          .sort((a, b) => a.used - b.used);
        for (const blob of candidates) {
          if (total <= target) break;
          gone.push(blob);
          total -= blob.size;
        }
      }
      for (const blob of gone) {
        await this._store.delete(blob.hash);
        const kept = this._memory.get(blob.hash);
        if (kept) {
          this._memory.delete(blob.hash);
          this._memoryBytes -= kept.length;
        }
      }
      if (gone.length)
        await transact(BLOBS, 'readwrite', (transaction) =>
          gone.map((blob) => transaction.objectStore(BLOBS).delete(blobKey(this.user, blob.hash))),
        );
    });
  }

  dispose(): void {
    clearTimeout(this._sweepTimer);
    void this._flushTouches();
  }

  /**
   * The record is written before the file: a tab closed in between leaves a record whose file is
   * missing (a miss, swept later), never a file no sweep knows of.
   */
  private async _set(hash: string, content: Uint8Array): Promise<void> {
    const recorded = await transact(BLOBS, 'readwrite', (transaction) =>
      transaction
        .objectStore(BLOBS)
        .put(
          { user: this.user, hash, size: content.length, used: Date.now() } satisfies BlobRecord,
          blobKey(this.user, hash),
        ),
    ).then(
      () => true,
      () => false,
    );
    if (!recorded) return;
    try {
      await this._store.set(hash, content);
    } catch (error) {
      const stored =
        (error as { name?: string })?.name === 'QuotaExceededError' &&
        (await this._makeRoom()
          .then(() => this._store.set(hash, content))
          .then(
            () => true,
            () => false,
          ));
      if (!stored) {
        await transact(BLOBS, 'readwrite', (transaction) =>
          transaction.objectStore(BLOBS).delete(blobKey(this.user, hash)),
        ).catch(() => undefined);
        return;
      }
    }
    this._writtenSinceSweep += content.length;
    if (!this._sweepTimer && this._writtenSinceSweep > this._options.budgetBytes() / 10)
      this._sweepTimer = setTimeout(() => void this.sweep().catch(() => undefined), 30_000);
  }

  /**
   * One sweep at a time for room, joined by every write that ran out of it meanwhile. Their
   * records are already written, so the sweep counts their bytes.
   */
  private _makeRoom(): Promise<void> {
    this._roomSweep ??= this.sweep()
      .catch(() => undefined)
      .finally(() => (this._roomSweep = undefined));
    return this._roomSweep;
  }

  private _remember(hash: string, bytes: Uint8Array): void {
    if (bytes.length > MEMORY_BYTES / 4) return;
    const known = this._memory.get(hash);
    if (known) {
      this._memory.delete(hash);
      this._memory.set(hash, known);
      return;
    }
    this._memory.set(hash, bytes);
    this._memoryBytes += bytes.length;
    for (const [oldest, old] of this._memory) {
      if (this._memoryBytes <= MEMORY_BYTES) break;
      this._memory.delete(oldest);
      this._memoryBytes -= old.length;
    }
  }

  private _touch(hash: string, size: number): void {
    this._touched.set(hash, size);
    this._touchTimer ??= setTimeout(() => void this._flushTouches(), TOUCH_DELAY_MS);
  }

  private async _flushTouches(): Promise<void> {
    clearTimeout(this._touchTimer);
    this._touchTimer = undefined;
    if (!this._touched.size) return;
    const touched = [...this._touched];
    this._touched.clear();
    const now = Date.now();
    await transact(BLOBS, 'readwrite', (transaction) =>
      touched.map(([hash, size]) =>
        transaction
          .objectStore(BLOBS)
          .put(
            { user: this.user, hash, size, used: now } satisfies BlobRecord,
            blobKey(this.user, hash),
          ),
      ),
    ).catch(() => undefined);
  }

  /** Keys and values are read in one transaction, so another tab's write can't misalign them. */
  private async _trees(): Promise<Map<string, FileEntry[]>> {
    const prefix = `${this.user}\0`;
    const range = IDBKeyRange.bound(prefix, `${prefix}\uffff`);
    let keys: IDBRequest<IDBValidKey[]> | undefined;
    let values: IDBRequest<FileEntry[][]> | undefined;
    await transact(TREES, 'readonly', (transaction) => {
      const store = transaction.objectStore(TREES);
      keys = store.getAllKeys(range);
      values = store.getAll(range);
      return [keys, values];
    });
    const all = values?.result ?? [];
    return new Map(
      (keys?.result ?? []).map((key, index) => [
        String(key).slice(prefix.length),
        all[index] ?? [],
      ]),
    );
  }

  private async _budget(): Promise<number> {
    const quota = (await navigator.storage?.estimate?.().catch(() => undefined))?.quota;
    const budget = this._options.budgetBytes();
    return quota ? Math.min(budget, quota * 0.1) : budget;
  }

  private _projectLock(projectId: string): string {
    return `nanoforge-project:${this.user}:${projectId}`;
  }

  /** Projects open in a tab of this browser (they hold their lock). */
  private async _openProjects(): Promise<Set<string>> {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    const prefix = `nanoforge-project:${this.user}:`;
    const held = (await locks?.query().catch(() => undefined))?.held ?? [];
    return new Set(
      held.flatMap((lock) =>
        lock.name?.startsWith(prefix) ? [lock.name.slice(prefix.length)] : [],
      ),
    );
  }

  private async _exclusive(run: () => Promise<void>): Promise<void> {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (!locks) return run();
    await locks.request(`nanoforge-cache-sweep:${this.user}`, run);
  }
}

/**
 * Removes what other users cached in this browser (a hosted editor on a shared computer): their
 * trees, records and contents.
 */
export const removeOtherUsers = async (user: string): Promise<void> => {
  const own = `${user}\0`;
  for (const store of [TREES, BLOBS, PROJECTS]) {
    const keys = await transact<IDBValidKey[]>(store, 'readonly', (transaction) =>
      transaction.objectStore(store).getAllKeys(),
    ).catch(() => [] as IDBValidKey[]);
    const others = keys.map(String).filter((key) => !key.startsWith(own));
    if (others.length)
      await transact(store, 'readwrite', (transaction) =>
        others.map((key) => transaction.objectStore(store).delete(key)),
      ).catch(() => undefined);
  }
};

/** The browser caches of the signed-in user, when this browser can keep them. */
export const ProjectCachesToken = createToken<ProjectCaches>('project.caches');
