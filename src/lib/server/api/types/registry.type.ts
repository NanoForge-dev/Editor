import type { PackageTypeEnum } from '$lib/server/project/package';

export interface RegistryPackageType {
  name: string;
  type: PackageTypeEnum;
  description: string;
  tags: string[];
  _file: string;
}
