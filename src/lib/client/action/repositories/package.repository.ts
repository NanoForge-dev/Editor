import type { EditorComponentManifest, EditorSystemManifest } from '@nanoforge-dev/ecs-lib';

import { BaseRepository } from '../base.repository';
import type {
  AddComponentsActionInput,
  AddSystemsActionInput,
  ComponentPackageResult,
  CreateComponentActionInput,
  CreateSystemActionInput,
  GetComponentsManifestsActionInput,
  GetSystemsManifestsActionInput,
  SystemPackageResult,
} from '../types';

export class ProjectPackageRepository extends BaseRepository {
  addComponents(input: AddComponentsActionInput): Promise<ComponentPackageResult[]> {
    return this.run(`/actions/project/package?/add-components`, input);
  }

  addSystems(input: AddSystemsActionInput): Promise<SystemPackageResult[]> {
    return this.run(`/actions/project/package?/add-systems`, input);
  }

  createComponent(input: CreateComponentActionInput): Promise<ComponentPackageResult> {
    return this.run(`/actions/project/package?/create-component`, input);
  }

  createSystem(input: CreateSystemActionInput): Promise<SystemPackageResult> {
    return this.run(`/actions/project/package?/create-system`, input);
  }

  getComponentsManifests(
    input: GetComponentsManifestsActionInput,
  ): Promise<EditorComponentManifest[]> {
    return this.run(`/actions/project/package?/get-components-manifests`, input);
  }

  getSystemsManifests(input: GetSystemsManifestsActionInput): Promise<EditorSystemManifest[]> {
    return this.run(`/actions/project/package?/get-systems-manifests`, input);
  }

  getComponents(): Promise<ComponentPackageResult[]> {
    return this.run(`/actions/project/package?/get-components`);
  }

  getSystems(): Promise<SystemPackageResult[]> {
    return this.run(`/actions/project/package?/get-systems`);
  }
}
