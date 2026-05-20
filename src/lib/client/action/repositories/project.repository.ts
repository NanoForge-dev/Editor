import type { EditorComponentManifest, EditorSystemManifest } from '@nanoforge-dev/ecs-lib';

import { BaseRepository } from '../base.repository';
import type {
  ActionProject,
  AddComponentsActionInput,
  AddSystemsActionInput,
  CreateComponentActionInput,
  CreateProjectActionInput,
  CreateSystemActionInput,
  GetComponentsManifestsActionInput,
  GetSaveResult,
  GetSystemsManifestsActionInput,
  LoadProjectActionInput,
  NewComponentPackageResult,
  NewSystemPackageResult,
  SetSaveInput,
} from '../types';

export class ProjectRepository extends BaseRepository {
  load(input: LoadProjectActionInput): Promise<ActionProject> {
    return this.run(`/actions/project?/load`, input);
  }
  new(input: CreateProjectActionInput): Promise<ActionProject> {
    return this.run(`/actions/project?/new`, input);
  }
  generate(): Promise<object> {
    return this.run(`/actions/project?/generate`);
  }
  build(): Promise<object> {
    return this.run(`/actions/project?/build`);
  }
  addComponents(input: AddComponentsActionInput): Promise<NewComponentPackageResult[]> {
    return this.run(`/actions/project?/addComponents`, input);
  }
  addSystems(input: AddSystemsActionInput): Promise<NewSystemPackageResult[]> {
    return this.run(`/actions/project?/addSystems`, input);
  }
  createComponent(input: CreateComponentActionInput): Promise<NewComponentPackageResult> {
    return this.run(`/actions/project?/createComponent`, input);
  }
  createSystem(input: CreateSystemActionInput): Promise<NewSystemPackageResult> {
    return this.run(`/actions/project?/createSystem`, input);
  }
  getComponentsManifests(
    input: GetComponentsManifestsActionInput,
  ): Promise<EditorComponentManifest[]> {
    return this.run(`/actions/project?/getComponentsManifests`, input);
  }
  getSystemsManifests(input: GetSystemsManifestsActionInput): Promise<EditorSystemManifest[]> {
    return this.run(`/actions/project?/getSystemsManifests`, input);
  }
  getSave(): Promise<GetSaveResult> {
    return this.run(`/actions/project?/getSave`);
  }
  setSave(input: SetSaveInput): Promise<object> {
    return this.run(`/actions/project?/setSave`, input);
  }
}
