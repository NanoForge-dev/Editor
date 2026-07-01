import { formatFrom } from '@utils/format';

import { PackageTypeEnum } from './package.enum';

export const PACKAGES_PATH: Record<PackageTypeEnum, string> = {
  [PackageTypeEnum.COMPONENT]: 'components',
  [PackageTypeEnum.SYSTEM]: 'systems',
  [PackageTypeEnum.ASSET]: 'static',
};

export const PACKAGES_NAME_FORMATTER: Record<PackageTypeEnum, (n: string) => string> = {
  [PackageTypeEnum.COMPONENT]: (n) => formatFrom.all(n).toPascal() + 'Component',
  [PackageTypeEnum.SYSTEM]: (n) => formatFrom.all(n).toCamel() + 'System',
  [PackageTypeEnum.ASSET]: (n) => n,
};

export const PACKAGES_PATH_FORMATTER: Record<PackageTypeEnum, (n: string) => string> = {
  [PackageTypeEnum.COMPONENT]: (n) => formatFrom.all(n).toKebab() + '.component',
  [PackageTypeEnum.SYSTEM]: (n) => formatFrom.all(n).toKebab() + '.system',
  [PackageTypeEnum.ASSET]: (n) => n,
};
