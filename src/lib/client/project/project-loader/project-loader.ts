import { get, writable } from 'svelte/store';

import {
  type ActionProject,
  type CompleteProjectActionInput,
  type CreateProjectActionInput,
  noProjectActions,
} from '$lib/client/action';
import { getConfig } from '$lib/client/config';
import { Project, ProjectCache, type ProjectDataCache } from '$lib/client/project';
import { SfsTreeCache } from '$lib/client/sync-file-system';

import { FileSystemManager } from '@utils-client/file-system';

import { PLErrors, PLException, runPLSafe } from './exceptions';
import { initTabs } from './init-functions';

type ProjectCacheResolvable = ActionProject;

const projectStore = writable<Project | null>(null);

export class ProjectLoader {
  static async create(input: CreateProjectActionInput) {
    const res = await runPLSafe(
      () => noProjectActions.project.new(input),
      (e) => new PLException(PLErrors.Invalid_Create_Action, e),
    );

    return ProjectLoader.init(res);
  }

  static async complete(input: CompleteProjectActionInput) {
    const res = await runPLSafe(
      () => noProjectActions.project.complete(input),
      (e) => new PLException(PLErrors.Invalid_Complete_Action, e),
    );

    return ProjectLoader.init(res);
  }

  static async loadFromCacheWithTryId(cache: ProjectDataCache) {
    try {
      return await ProjectLoader.loadFromId(cache.id);
    } catch {
      /* empty */
    }

    return ProjectLoader.loadFromCache(cache);
  }

  static async loadFromIdWithCacheFetching(id: string) {
    try {
      return await ProjectLoader.loadFromId(id);
    } catch {
      /* empty */
    }

    const cache = await ProjectCache.getProject(id);

    return ProjectLoader.loadFromCache(cache);
  }

  static async loadFromCache(cache: ProjectDataCache) {
    await ProjectCache.removeProject(cache.id);
    const config = getConfig();
    const input =
      config.mode === 'offline' ? { path: cache.resolvable } : { gatewayId: cache.resolvable };

    const res = await noProjectActions.project.load(input);

    const treeCache = new SfsTreeCache(cache.id);
    await treeCache.init();
    await treeCache.changeId(res.id);

    const fs = new FileSystemManager('projects');
    const dir = await fs.getDirectory(cache.id);
    await dir.rename(res.id);

    return await ProjectLoader.init(res);
  }

  static async loadFromPath(path: string) {
    const res = await noProjectActions.project.load({ path });

    return ProjectLoader.init(res);
  }

  static async loadFromGatewayId(gatewayId: string) {
    const res = await noProjectActions.project.load({ gatewayId });

    return ProjectLoader.init(res);
  }

  static async loadFromId(id: string) {
    const res = await noProjectActions.project.load({ id });

    return ProjectLoader.init(res);
  }

  static async init(input: ProjectCacheResolvable): Promise<Project> {
    Project.reset();

    const project = new Project(input.id);
    projectStore.set(project);

    const infos = await runPLSafe(
      () => project.info.get(),
      () => new PLException(PLErrors.Empty_Project, input.id, input.cacheResolvable),
    );

    await ProjectCache.addOrUpdateProject({
      id: input.id,
      resolvable: input.cacheResolvable,
      name: infos.name,
      lastOpened: Date.now(),
    });

    await this.initFunctions(project);

    return project;
  }

  static async initFunctions(project: Project): Promise<void> {
    initTabs(project);
  }

  static unload() {
    projectStore.set(null);
    Project.reset();
  }
}

export const useProject = () => {
  const project = get(projectStore);
  if (!project) {
    const error = new PLException(PLErrors.No_Project);
    void error.fb();
    throw error;
  }

  if (!project.isReady()) {
    const error = new PLException(PLErrors.No_Init_Project, project.id);
    void error.fb();
    throw error;
  }

  return project;
};

export const getProject = () => get(projectStore);

export const getProjectStore = () => projectStore;
