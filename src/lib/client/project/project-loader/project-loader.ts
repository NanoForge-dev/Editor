import { get, writable } from 'svelte/store';

import { type ActionProject, type CreateProjectActionInput, actions } from '$lib/client/action';
import { getConfig } from '$lib/client/config/config';
import { Project } from '$lib/client/project';

const projectStore = writable<Project | null>(null);

export class ProjectLoader {
  static async create(input: CreateProjectActionInput) {
    const res = await actions.project.new(input);

    return ProjectLoader.init(res);
  }

  static async loadFromCache(resolvable: string) {
    const config = getConfig();
    const input = config.mode === 'offline' ? { path: resolvable } : { gatewayId: resolvable };

    const res = await actions.project.load(input);

    return ProjectLoader.init(res);
  }

  static unload() {
    projectStore.set(null);
    Project.reset();
  }

  static async init(input: ActionProject): Promise<Project> {
    Project.reset();

    const project = new Project(input.id);
    await project.init();
    projectStore.set(project);
    return project;
  }
}

export const useProject = () => get(projectStore);
