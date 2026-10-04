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
    const model = await this._rpc.api(ProjectsContract).model({ id });
    const project = new ClientProject(model, this._rpc, this._caches);
    onStage?.('files');
    await project.fs.initialize();
    this.close();
    this._current.set(project);
    return project;
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
