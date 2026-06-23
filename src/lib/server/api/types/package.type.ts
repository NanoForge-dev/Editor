import type { PackageTypeEnum } from '$lib/server/project/package';

export interface Package {
  id: string;
  name: string;
  type: PackageTypeEnum;
  description: string | null;
  tags: string[];
}
