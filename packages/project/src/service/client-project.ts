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
import { MemoryContentCache } from '../cache/memory.content-cache';
import { MemoryTreeCache } from '../cache/memory.tree-cache';
import { ProjectFs } from '../fs/project-fs';

/** Where a project's files are cached (`ProjectCaches` in browsers that can keep them). */
export interface CacheFactory {
  contents(projectId: string): ContentCache;
  tree(projectId: string): TreeCache;
  /** Called when a project opens; the lease is disposed when it closes. */
  opened?(projectId: string): Disposable;
}

/** Caches that live as long as the page (tests, browsers without storage). */
export const memoryCacheFactory = (): CacheFactory => {
  const contents = new MemoryContentCache();
  return { contents: () => contents, tree: () => new MemoryTreeCache() };
};

/** A project opened in this editor window. */
export class ClientProject implements Disposable, EngineLibProvider {
  private readonly _store = new DisposableStore();
  private readonly _model: ObservableValue<ProjectModel>;

  readonly fs: ProjectFs;
  /** Apps as the kernel sees them (engine lib gating). */
  readonly apps: Observable<readonly AppInfo[]>;

  constructor(
    initial: ProjectModel,
    rpc: RpcClient,
    caches: CacheFactory,
    /**
     * Whether its code may run here. An untrusted local folder is open in restricted mode: its
     * config is read without running it, and its plugins, builds and games don't run.
     */
    readonly trusted: boolean,
  ) {
    this._model = new ObservableValue(initial);
    this.fs = this._store.add(
      new ProjectFs(initial.id, rpc, caches.contents(initial.id), caches.tree(initial.id)),
    );
    const lease = caches.opened?.(initial.id);
    if (lease) this._store.add(lease);
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
