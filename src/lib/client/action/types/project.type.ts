import type { LoadProjectBody } from '$lib/server/actions/project/load.action';
import type { CreateProjectBody } from '$lib/server/actions/project/new.action';
import type { Project } from '$lib/server/project';

export type ActionProject = Project;

export type LoadProjectActionInput = LoadProjectBody;

export type CreateProjectActionInput = CreateProjectBody;

export interface AddComponentsActionInput {
  componentNames: [string, ...string[]];
}

export interface AddSystemsActionInput {
  systemNames: [string, ...string[]];
}

export interface GetComponentsManifestsActionInput {
  componentPaths: string[];
}

export interface GetSystemsManifestsActionInput {
  systemPaths: string[];
}

export interface CreateComponentActionInput {
  componentName: string;
}

export interface CreateSystemActionInput {
  systemName: string;
}
