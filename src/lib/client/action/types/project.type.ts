import type { EditorComponentManifest, EditorSystemManifest } from '@nanoforge-dev/ecs-lib';

import type { Project } from '$lib/server/project';

import type { Save, SaveComponent, SaveSystem } from '@utils/types';

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

export interface NewComponentPackageResult {
  manifest: EditorComponentManifest;
  save: SaveComponent;
}

export interface NewSystemPackageResult {
  manifest: EditorSystemManifest;
  save: SaveSystem;
}

export interface AddComponentsActionInput {
  componentNames: [string, ...string[]];
}

export interface AddSystemsActionInput {
  systemNames: [string, ...string[]];
}

export interface CreateComponentActionInput {
  componentName: string;
}

export interface CreateSystemActionInput {
  systemName: string;
}

export interface GetSaveResult {
  save: Save;
}

export interface SetSaveInput {
  save: Save;
}
