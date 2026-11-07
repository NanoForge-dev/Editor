import { z } from 'zod';

import { Dependencies, ItemName, ItemVersion } from '../item/item.schema';

export const PackagesList = z.object({ packages: Dependencies.default({}) }).loose();
export const PackagesLock = z.object({
  lockVersion: z.literal(1),
  packages: z
    .record(
      ItemName,
      z.object({
        version: ItemVersion,
        sha256: z.string().regex(/^[0-9a-f]{64}$/, 'expected a sha256 in hex'),
        dependencies: Dependencies.default({}),
      }),
    )
    .default({}),
});
export type Lock = z.output<typeof PackagesLock>['packages'];
