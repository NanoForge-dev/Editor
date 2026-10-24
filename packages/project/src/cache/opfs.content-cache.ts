import type { CachedContent, ContentCache } from './cache.type';

/**
 * OPFS content cache: `nanoforge-editor/<projectId>/<encoded path>` holds the bytes and a
 * small sidecar JSON holds mtime and hash. Failures degrade to cache misses.
 */
export class OpfsContentCache implements ContentCache {
  private _dir: Promise<FileSystemDirectoryHandle> | undefined;

  static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function'
    );
  }

  constructor(private readonly _projectId: string) {}

  async get(path: string): Promise<CachedContent | undefined> {
    try {
      const dir = await this._directory();
      const meta = await (await (await dir.getFileHandle(`${key(path)}.meta`)).getFile()).text();
      const bytes = await (await (await dir.getFileHandle(key(path))).getFile()).arrayBuffer();
      const { mtime, hash } = JSON.parse(meta) as { mtime: number; hash: string };
      return { content: new Uint8Array(bytes), mtime, hash };
    } catch {
      return undefined;
    }
  }

  async set(path: string, value: CachedContent): Promise<void> {
    try {
      const dir = await this._directory();
      await write(dir, key(path), value.content);
      await write(
        dir,
        `${key(path)}.meta`,
        JSON.stringify({ mtime: value.mtime, hash: value.hash }),
      );
    } catch {}
  }

  async delete(path: string): Promise<void> {
    try {
      const dir = await this._directory();
      const prefix = key(path);
      for await (const name of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) {
        if (name === prefix || name === `${prefix}.meta` || name.startsWith(`${prefix}%2F`)) {
          await dir.removeEntry(name);
        }
      }
    } catch {}
  }

  async clear(): Promise<void> {
    try {
      const root = await (
        await navigator.storage.getDirectory()
      ).getDirectoryHandle('nanoforge-editor', { create: true });
      await root.removeEntry(this._projectId, { recursive: true });
      this._dir = undefined;
    } catch {}
  }

  private _directory(): Promise<FileSystemDirectoryHandle> {
    this._dir ??= navigator.storage
      .getDirectory()
      .then((root) => root.getDirectoryHandle('nanoforge-editor', { create: true }))
      .then((root) => root.getDirectoryHandle(this._projectId, { create: true }));
    return this._dir;
  }
}

export const key = (path: string) => encodeURIComponent(path);

export const write = async (
  dir: FileSystemDirectoryHandle,
  name: string,
  data: Uint8Array | string,
) => {
  const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await writable.write(typeof data === 'string' ? data : new Blob([data as BlobPart]));
  await writable.close();
};
