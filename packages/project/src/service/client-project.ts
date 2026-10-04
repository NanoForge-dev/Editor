import {
  type AppInfo,
  type Disposable,
  DisposableStore,
  type EngineLibProvider,
  type Observable,
  ObservableValue,
  derived,
} from '@nanoforge-dev/editor-kernel';
import { type ProjectModel, ProjectsContract } from '@nanoforge-dev/editor-protocol';
import type { RpcClient } from '@nanoforge-dev/editor-rpc';

import type { ContentCache, TreeCache } from '../cache/cache.type';
import { IndexedDbTreeCache } from '../cache/indexed-db.tree-cache';
import { MemoryContentCache } from '../cache/memory.content-cache';
import { MemoryTreeCache } from '../cache/memory.tree-cache';
import { OpfsContentCache } from '../cache/opfs.content-cache';
import { ProjectFs } from '../fs/project-fs';

export interface CacheFactory {
  contents(projectId: string): ContentCache;
  tree(projectId: string): TreeCache;
}

/** Browser caches when available, memory otherwise. */
export const defaultCacheFactory: CacheFactory = {
  contents: (id) =>
    OpfsContentCache.isSupported() ? new OpfsContentCache(id) : new MemoryContentCache(),
  tree: (id) =>
    IndexedDbTreeCache.isSupported() ? new IndexedDbTreeCache(id) : new MemoryTreeCache(),
};

/** A project opened in this editor window. */
export class ClientProject implements Disposable, EngineLibProvider {
  private readonly _store = new DisposableStore();
  private readonly _model: ObservableValue<ProjectModel>;

  readonly fs: ProjectFs;
  /** Apps as the kernel sees them (engine lib gating). */
  readonly apps: Observable<readonly AppInfo[]>;

  constructor(initial: ProjectModel, rpc: RpcClient, caches: CacheFactory) {
    this._model = new ObservableValue(initial);
    this.fs = this._store.add(
      new ProjectFs(initial.id, rpc, caches.contents(initial.id), caches.tree(initial.id)),
    );
    this._store.add(
      rpc.subscribe(ProjectsContract, 'model', { id: initial.id }, (model) =>
        this._model.set(model),
      ),
    );
    this.apps = derived([this._model], (model) =>
      model.apps.map((app) => ({
        id: app.id,
        name: app.name,
        type: app.type,
        engineLibs: app.engineLibs,
      })),
    );
  }

  get id(): string {
    return this._model.get().id;
  }

  get model(): Observable<ProjectModel> {
    return this._model.readonly();
  }

  dispose(): void {
    this._store.dispose();
  }
}
