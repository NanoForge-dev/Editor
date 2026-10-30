import type { ContentCache } from './cache.type';
import { canWriteOpfs, writeOpfsFile } from './opfs-write';
import { sha1Hex } from './sha1';

/** The folder of the editor in the origin private file system. */
export const OPFS_ROOT = 'nanoforge-editor';
/** The layout of this version: `v2/<user>/blobs/<sha1>`. Anything else in the root is older. */
export const OPFS_LAYOUT = 'v2';

/**
 * OPFS content cache of one user: `nanoforge-editor/v2/<user>/blobs/<sha1>`. Every read checks
 * the bytes against their hash, so a write cut short (or any mistake) is a miss, never the wrong
 * content. Failures degrade to misses; `set` throws (`QuotaExceededError`) for the caller to
 * make room.
 */
export class OpfsContentCache implements ContentCache {
  private _dir: Promise<FileSystemDirectoryHandle> | undefined;

  static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.storage?.getDirectory === 'function' &&
      typeof crypto !== 'undefined' &&
      typeof crypto.subtle?.digest === 'function' &&
      canWriteOpfs()
    );
  }

  constructor(private readonly _user: string) {}

  async get(hash: string): Promise<Uint8Array | undefined> {
    try {
      const file = await (await (await this._directory()).getFileHandle(hash)).getFile();
      const bytes = new Uint8Array(await file.arrayBuffer());
      if ((await sha1Hex(bytes)) === hash) return bytes;
      await this.delete(hash);
    } catch {}
    return undefined;
  }

  async set(hash: string, content: Uint8Array): Promise<void> {
    await writeOpfsFile([OPFS_ROOT, OPFS_LAYOUT, this._folder(), 'blobs', hash], content);
  }

  async delete(hash: string): Promise<void> {
    try {
      await (await this._directory()).removeEntry(hash);
    } catch {}
  }

  /** Removes every content of this user. */
  async clear(): Promise<void> {
    try {
      const layout = await (
        await navigator.storage.getDirectory()
      )
        .getDirectoryHandle(OPFS_ROOT)
        .then((root) => root.getDirectoryHandle(OPFS_LAYOUT));
      await layout.removeEntry(this._folder(), { recursive: true });
    } catch {}
    this._dir = undefined;
  }

  private _folder(): string {
    return encodeURIComponent(this._user);
  }

  private _directory(): Promise<FileSystemDirectoryHandle> {
    this._dir ??= navigator.storage
      .getDirectory()
      .then((root) => root.getDirectoryHandle(OPFS_ROOT, { create: true }))
      .then((root) => root.getDirectoryHandle(OPFS_LAYOUT, { create: true }))
      .then((root) => root.getDirectoryHandle(this._folder(), { create: true }))
      .then((root) => root.getDirectoryHandle('blobs', { create: true }));
    return this._dir;
  }
}

/**
 * Removes what older versions left in the editor's OPFS folder (`<projectId>/` folders of
 * per-path copies), and the folders of other users when `keepUser` is given.
 */
export const removeStaleOpfs = async (keepUser?: string): Promise<void> => {
  try {
    const root = await (
      await navigator.storage.getDirectory()
    ).getDirectoryHandle(OPFS_ROOT, {
      create: true,
    });
    for await (const name of (root as unknown as { keys(): AsyncIterable<string> }).keys())
      if (name !== OPFS_LAYOUT) await root.removeEntry(name, { recursive: true }).catch(() => {});
    if (keepUser === undefined) return;
    const layout = await root.getDirectoryHandle(OPFS_LAYOUT, { create: true });
    for await (const name of (layout as unknown as { keys(): AsyncIterable<string> }).keys())
      if (name !== encodeURIComponent(keepUser))
        await layout.removeEntry(name, { recursive: true }).catch(() => {});
  } catch {}
};
