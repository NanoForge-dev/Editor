import type { ComponentManifest, SystemManifest } from '$lib/server/project/package';

import { BaseRepository } from '../base.repository';
import type {
  ComponentPkg,
  CreateComponentActionInput,
  CreateSystemActionInput,
  GetComponentsManifestsActionInput,
  GetSystemsManifestsActionInput,
  InstallPackagesActionInput,
  Package,
  SearchInput,
  SearchPackages,
  SystemPkg,
} from '../types';

export class ProjectPackageRepository extends BaseRepository {
  createComponent(input: CreateComponentActionInput): Promise<ComponentPkg> {
    return this.run(`/actions/project/package?/create-component`, input);
  }

  createSystem(input: CreateSystemActionInput): Promise<SystemPkg> {
    return this.run(`/actions/project/package?/create-system`, input);
  }

  getComponentsManifests(input: GetComponentsManifestsActionInput): Promise<ComponentManifest[]> {
    return this.run(`/actions/project/package?/get-components-manifests`, input);
  }

  getSystemsManifests(input: GetSystemsManifestsActionInput): Promise<SystemManifest[]> {
    return this.run(`/actions/project/package?/get-systems-manifests`, input);
  }

  getComponents(): Promise<ComponentPkg[]> {
    return this.run(`/actions/project/package?/get-components`);
  }

  getSystems(): Promise<SystemPkg[]> {
    return this.run(`/actions/project/package?/get-systems`);
  }

  installPackages(input: InstallPackagesActionInput): Promise<Package[]> {
    return this.run(`/actions/project/package?/install-packages`, input);
  }

  searchPackages(input: SearchInput): Promise<SearchPackages> {
    return this.run(`/actions/project/package?/search-packages`, input);
  }
}
