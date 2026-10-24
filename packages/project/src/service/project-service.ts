import {
  type Disposable,
  type Observable,
  ObservableValue,
  createToken,
} from '@nanoforge-dev/editor-kernel';
import {
  type ProjectRef,
  ProjectsContract,
  type RecentProject,
} from '@nanoforge-dev/editor-protocol';
import type { RpcClient } from '@nanoforge-dev/editor-rpc';

import { type CacheFactory, ClientProject, defaultCacheFactory } from './client-project';

/** Opens projects through the editor server; one project is active per window. */
export class ProjectService implements Disposable {
  private readonly _current = new ObservableValue<ClientProject | undefined>(undefined);

  constructor(
    private readonly _rpc: RpcClient,
    private readonly _caches: CacheFactory = defaultCacheFactory,
  ) {}

  get current(): Observable<ClientProject | undefined> {
    return this._current.readonly();
  }

  async open(ref: ProjectRef): Promise<ClientProject> {
    const projects = this._rpc.api(ProjectsContract);
    const { id } = await projects.open(ref);
    return this.load(id);
  }

  /** Attaches to a project already opened on the server (e.g. `/project/<id>` reload). */
  async load(id: string, onStage?: (stage: 'model' | 'files') => void): Promise<ClientProject> {
    if (this._current.get()?.id === id) return this._current.get()!;
    onStage?.('model');
    const api = this._rpc.api(ProjectsContract);
    const [model, trusted] = await Promise.all([api.model({ id }), api.isTrusted({ id })]);
    const project = new ClientProject(model, this._rpc, this._caches, trusted);
    onStage?.('files');
    await project.fs.initialize();
    this.close();
    this._current.set(project);
    return project;
  }

  /**
   * Trusts the open local project's folder: its code runs from now on (config, plugins, builds,
   * games). The server reopens it and this one closes: load it again (`load`, or a reload).
   */
  async trust(): Promise<void> {
    const current = this._current.get();
    if (!current) return;
    const api = this._rpc.api(ProjectsContract);
    await api.trust({ id: current.id });
    await api.open({ path: current.model.get().location });
    if (this._current.get() === current) this.close();
  }

  recent(): Promise<RecentProject[]> {
    return this._rpc.api(ProjectsContract).recent(null);
  }

  close(): void {
    const current = this._current.get();
    this._current.set(undefined);
    current?.dispose();
  }

  dispose(): void {
    this.close();
  }
}

export const ProjectServiceToken = createToken<ProjectService>('project.service');
