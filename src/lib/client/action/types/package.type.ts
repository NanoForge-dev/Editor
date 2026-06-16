import type { CreateComponentBody } from '$lib/server/actions/project/package/create-component.action';
import type { CreateSystemBody } from '$lib/server/actions/project/package/create-system.action';
import type { InstallPackagesBody } from '$lib/server/actions/project/package/install-packages.action';
import type { SearchPackagesBody } from '$lib/server/actions/project/package/search-packages.action';
import type { PaginateResult, Package as ServerPackage } from '$lib/server/api';
import type {
  AssetPackage,
  ComponentPackage,
  SystemPackage,
} from '$lib/server/project/package/package.type';

export type ComponentPkg = ComponentPackage;

export type SystemPkg = SystemPackage;

export type AssetPkg = AssetPackage;

export type Package = ComponentPackage | SystemPackage;

export type InstallPackagesActionInput = InstallPackagesBody;

export type CreateComponentActionInput = CreateComponentBody;

export type CreateSystemActionInput = CreateSystemBody;

export type SearchInput = SearchPackagesBody;

export type ApiPackage = ServerPackage;

export type SearchPackages = PaginateResult<ApiPackage>;
