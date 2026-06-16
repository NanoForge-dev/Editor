import { BaseRepository } from '../base.repository';
import type {
  AssetPkg,
  ComponentPkg,
  CreateComponentActionInput,
  CreateSystemActionInput,
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

  getComponents(): Promise<ComponentPkg[]> {
    return this.run(`/actions/project/package?/get-components`);
  }

  getSystems(): Promise<SystemPkg[]> {
    return this.run(`/actions/project/package?/get-systems`);
  }

  getAssets(): Promise<AssetPkg[]> {
    return this.run(`/actions/project/package?/get-assets`);
  }

  installPackages(input: InstallPackagesActionInput): Promise<Package[]> {
    return this.run(`/actions/project/package?/install-packages`, input);
  }

  searchPackages(input: SearchInput): Promise<SearchPackages> {
    return this.run(`/actions/project/package?/search-packages`, input);
  }
}
