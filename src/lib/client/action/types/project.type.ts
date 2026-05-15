import type { Project } from '$lib/server/project';

export type ActionProject = Project;

export interface LoadProjectActionInput {
  path?: string;
  gitUrl?: string;
  gatewayId?: string;
}

export interface CreateProjectActionInput {
  projectName: string;

  projectPath?: string;
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  language?: 'js' | 'ts';
  multiplayerServer?: boolean;
  dockerContainerization?: boolean;
  createGitRepository?: boolean;
  gitRemote?: string | false;
}

export interface AddRegistryComponentActionResult {
  newComponentsPaths: string[];
}

export interface AddComponentActionInput {
  componentNames: [string, ...string[]];

  server: true | undefined;
}

export interface AddSystemActionInput {
  systemNames: [string, ...string[]];

  server: true | undefined;
}
