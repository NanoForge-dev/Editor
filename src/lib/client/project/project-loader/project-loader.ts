import { get, writable } from 'svelte/store';

import {
  type ActionProject,
  type CreateProjectActionInput,
  noProjectActions,
} from '$lib/client/action';
import { getConfig } from '$lib/client/config/config';
import { Project, ProjectCache, type ProjectDataCache } from '$lib/client/project';
import { SfsTreeCache } from '$lib/client/sync-file-system';

import { FileSystemManager } from '@utils-client/file-system';

const projectStore = writable<Project | null>(null);

export class ProjectLoader {
  static async create(input: CreateProjectActionInput) {
    const res = await noProjectActions.project.new(input);

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

    return ProjectLoader.init(res);
  }

  static async loadFromPath(path: string) {
    const res = await noProjectActions.project.load({ path });

    return ProjectLoader.init(res);
  }

  static async loadFromId(id: string) {
    const res = await noProjectActions.project.load({ id });

    return ProjectLoader.init(res);
  }

  static unload() {
    projectStore.set(null);
    Project.reset();
  }

  static async init(input: ActionProject): Promise<Project> {
    Project.reset();

    const project = new Project(input.id);
    // @todo add a route to check if the project is valid
    projectStore.set(project);

    const infos = await project.info.get();

    await ProjectCache.addOrUpdateProject({
      id: input.id,
      resolvable: input.cacheResolvable,
      name: infos.name,
      lastOpened: Date.now(),
    });
    return project;
  }
}

export const useProject = () => {
  const project = get(projectStore);
  if (!project) throw new Error('Project not loaded');
  return project;
};

export const getProject = () => get(projectStore);
