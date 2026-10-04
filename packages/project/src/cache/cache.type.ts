import type { FileEntry } from '@nanoforge-dev/editor-protocol';

export interface CachedContent {
  readonly content: Uint8Array;
  readonly mtime: number;
  readonly hash: string;
}

/** File contents cache (OPFS in browsers). Keys are project-relative paths. */
export interface ContentCache {
  get(path: string): Promise<CachedContent | undefined>;
  set(path: string, value: CachedContent): Promise<void>;
  delete(path: string): Promise<void>;
  clear(): Promise<void>;
}

/** Last known file tree (IndexedDB in browsers), for fast startup before revalidation. */
export interface TreeCache {
  load(): Promise<FileEntry[] | undefined>;
  save(entries: readonly FileEntry[]): Promise<void>;
}
