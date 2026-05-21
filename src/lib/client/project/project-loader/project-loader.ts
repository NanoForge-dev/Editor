import { get, writable } from 'svelte/store';

import {
  type ActionProject,
  type CreateProjectActionInput,
  noProjectActions,
} from '$lib/client/action';
import { getConfig } from '$lib/client/config/config';
import { Project, ProjectCache, type ProjectDataCache } from '$lib/client/project';

const projectStore = writable<Project | null>(null);

export class ProjectLoader {
  static async create(input: CreateProjectActionInput) {
    const res = await noProjectActions.project.new(input);

    return ProjectLoader.init(res);
  }

  static async oldLoad(resolvable: string) {
    const config = getConfig();
    const input = config.mode === 'offline' ? { path: resolvable } : { gatewayId: resolvable };

    const res = await noProjectActions.project.load(input);

    return ProjectLoader.init(res);
  }

  static async loadFromCache(cache: ProjectDataCache) {
    try {
      return await ProjectLoader.loadFromId(cache.id);
    } catch {
      /* empty */
    }

    await ProjectCache.removeProject(cache.id);
    const config = getConfig();
    const input =
      config.mode === 'offline' ? { path: cache.resolvable } : { gatewayId: cache.resolvable };

    const res = await noProjectActions.project.load(input);

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
    // @todo to move to dashboard
    await project.init();
    projectStore.set(project);
    await ProjectCache.addOrUpdateProject({
      id: input.id,
      resolvable: input.cacheResolvable,
      name: input.name,
      lastOpened: Date.now(),
    });
    return project;
  }
}

export const useProject = () => get(projectStore);
