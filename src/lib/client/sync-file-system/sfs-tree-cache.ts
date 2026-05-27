import { IndexedDB } from '@utils-client/indexed-db';

import { type SfsDirectoryMap } from './sfs-directory';

export const SFS_DB_STORE_NAME = 'fs-project-tree';

export class SfsTreeCache extends IndexedDB {
  constructor(private readonly projectId: string) {
    super();
  }

  init(): Promise<void> {
    return this.open(1, async (db) => {
      db.createObjectStore(SFS_DB_STORE_NAME);
    });
  }

  async changeId(newId: string): Promise<void> {
    const store = this.getStore(SFS_DB_STORE_NAME);
    const data = await store.get<SfsDirectoryMap>(this.projectId);
    if (!data) return;
    await store.set(newId, data);
    await store.delete(this.projectId);
  }

  async read(path: string): Promise<SfsDirectoryMap | null> {
    const store = this.getStore(SFS_DB_STORE_NAME);
    const data = await store.get<SfsDirectoryMap>(this.projectId);
    return this._extractMapFromPath(path, data ?? null);
  }

  async write(path: string, data: SfsDirectoryMap): Promise<void> {
    const currentData = await this.read(path);
    const store = this.getStore(SFS_DB_STORE_NAME);
    const map = this._generateMapFromPath(
      path,
      currentData ?? { files: [], directories: {} },
      data,
    );
    await store.set(this.projectId, map);
  }

  private _extractMapFromPath(path: string, map: SfsDirectoryMap | null): SfsDirectoryMap | null {
    const parts = path.split('/');
    let currentMap: SfsDirectoryMap | null = map;
    for (const part of parts) {
      if (currentMap === null) return null;
      if (part in currentMap.directories) currentMap = currentMap.directories[part] ?? null;
    }
    return currentMap;
  }

  private _generateMapFromPath(
    path: string,
    map: SfsDirectoryMap,
    data: SfsDirectoryMap,
  ): SfsDirectoryMap | null {
    if (!path) return data;
    const parts = path.split('/');
    return this._generateMapFromPathRec(parts, map, data);
  }

  private _generateMapFromPathRec(
    parts: string[],
    map: SfsDirectoryMap,
    data: SfsDirectoryMap,
  ): SfsDirectoryMap | null {
    if (parts.length === 0) return data;
    const [part, ...rest] = parts;

    map.directories[part] = this._generateMapFromPathRec(
      rest,
      map.directories[part] ?? { files: [], directories: {} },
      data,
    );
    return map;
  }
}
