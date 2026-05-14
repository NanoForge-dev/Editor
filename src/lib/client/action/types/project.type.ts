import type { Project } from '$lib/server/project';

export type ActionProject = Project;

export interface LoadProjectActionInput {
  path?: string;
  gitUrl?: string;
  gatewayId?: string;
}
