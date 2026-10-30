import type { FileEntry } from '@nanoforge-dev/editor-protocol';

/**
 * File contents by the sha1 of their bytes (OPFS in browsers): each content is kept once, for
 * every project and branch that has it; the tree (`FileEntry.hash`) says which one a path holds.
 */
export interface ContentCache {
  /** The bytes of a content, or undefined when they are not kept (or do not match the hash). */
  get(hash: string): Promise<Uint8Array | undefined>;
  set(hash: string, content: Uint8Array): Promise<void>;
}

/** Last known file tree of a project (IndexedDB in browsers), for a fast start and as the index. */
export interface TreeCache {
  load(): Promise<FileEntry[] | undefined>;
  save(entries: readonly FileEntry[]): Promise<void>;
}
