import { z } from 'zod';

import { Dependencies, ItemName, ItemType, ItemVersion } from '../item/item.schema';

/**
 * What goes over HTTP: routes and documents after the npm registry's (a "packument" per item,
 * archives under `/-/`, search under `/-/v1/search`), so people and tools that know npm find
 * their way. Differences: every item has a `type`, archives are zip files, and their hash is a
 * hex sha256. The contract is `docs/api/registry.md`.
 */
export const ROUTES = {
  search: '/registry/-/v1/search',
  item: (name: string) => `/registry/${name}`,
  /** `@scope/name` 1.2.3 → `/registry/@scope/name/-/name-1.2.3.zip`. */
  archive: (name: string, version: string) =>
    `/registry/${name}/-/${name.split('/')[1]}-${version}.zip`,
};

const Person = z.object({ name: z.string().default('') }).loose();

export const WireVersion = z
  .object({
    name: ItemName,
    version: ItemVersion,
    type: ItemType,
    dependencies: Dependencies.default({}),
    engines: z.record(z.string(), z.string()).default({}),
    dist: z
      .object({
        /** URL of the archive, absolute or relative to the registry's base URL. */
        file: z.string(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        size: z.number().int().nonnegative().optional(),
      })
      .loose(),
  })
  .loose();
export type WireVersion = z.output<typeof WireVersion>;

export const Packument = z
  .object({
    name: ItemName,
    type: ItemType,
    description: z.string().default(''),
    author: Person.optional(),
    readme: z.string().default(''),
    'dist-tags': z.object({ latest: ItemVersion }).loose(),
    versions: z.record(z.string(), WireVersion),
    /** ISO dates by version (npm also keeps `created` and `modified` here). */
    time: z.record(z.string(), z.string()).default({}),
    downloads: z.object({ total: z.number().int().nonnegative().default(0) }).optional(),
  })
  .loose();
export type Packument = z.output<typeof Packument>;

export const WireSearch = z.object({
  objects: z.array(
    z
      .object({
        package: z
          .object({
            name: ItemName,
            type: ItemType,
            version: ItemVersion,
            description: z.string().default(''),
            date: z.string().default(''),
            author: Person.optional(),
          })
          .loose(),
        downloads: z.object({ total: z.number().int().nonnegative().default(0) }).optional(),
      })
      .loose(),
  ),
  total: z.number().int().nonnegative(),
});
export type WireSearch = z.output<typeof WireSearch>;
