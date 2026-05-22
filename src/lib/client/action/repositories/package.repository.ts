import type { EditorComponentManifest, EditorSystemManifest } from '@nanoforge-dev/ecs-lib';

import { BaseRepository } from '../base.repository';
import type {
  AddComponentsActionInput,
  AddSystemsActionInput,
  CreateComponentActionInput,
  CreateSystemActionInput,
  GetComponentsManifestsActionInput,
  GetSystemsManifestsActionInput,
  NewComponentPackageResult,
  NewSystemPackageResult,
} from '../types';

export class ProjectPackageRepository extends BaseRepository {
  addComponents(input: AddComponentsActionInput): Promise<NewComponentPackageResult[]> {
    return this.run(`/actions/project/package?/addComponents`, input);
  }

  addSystems(input: AddSystemsActionInput): Promise<NewSystemPackageResult[]> {
    return this.run(`/actions/project/package?/addSystems`, input);
  }

  createComponent(input: CreateComponentActionInput): Promise<NewComponentPackageResult> {
    return this.run(`/actions/project/package?/createComponent`, input);
  }

  createSystem(input: CreateSystemActionInput): Promise<NewSystemPackageResult> {
    return this.run(`/actions/project/package?/createSystem`, input);
  }

  getComponentsManifests(
    input: GetComponentsManifestsActionInput,
  ): Promise<EditorComponentManifest[]> {
    return this.run(`/actions/project/package?/getComponentsManifests`, input);
  }

  getSystemsManifests(input: GetSystemsManifestsActionInput): Promise<EditorSystemManifest[]> {
    return this.run(`/actions/project/package?/getSystemsManifests`, input);
  }
}
