import { z } from 'zod';

import {
  ItemName,
  ItemType,
  ItemVersion,
  Kinds,
  ManifestDependencies,
  VersionContent,
} from '../item/item.schema';

/**
 * What goes over HTTP: routes and documents after the npm registry's (a "packument" per item,
 * archives under `/-/`, search under `/-/v1/search`), so people and tools that know npm find
 * their way. Differences: every item has a `type`, archives are zip files, every version says
 * what it holds (`contents`, counted in `kinds`), and `dist` adds a hex `sha256` to npm's
 * hashes. The contract is `docs/api/registry.md`.
 */
export const ROUTES = {
  search: '/registry/-/v1/search',
  item: (name: string) => `/registry/${name}`,
  /** `@scope/name` 1.2.3 → `/registry/@scope/name/-/name-1.2.3.zip`. */
  archive: (name: string, version: string) =>
    `/registry/${name}/-/${name.split('/')[1]}-${version}.zip`,
};

/** `{ name, email?, url? }`; npm also writes `"Name <email> (url)"`. */
const Person = z.union([
  z.object({ name: z.string().default('') }).loose(),
  z.string().transform((text) => ({ name: text.replace(/\s*[<(].*$/, '') })),
]);

export const WireVersion = z
  .object({
    name: ItemName,
    version: ItemVersion,
    type: ItemType,
    dependencies: ManifestDependencies.default({}),
    engines: z.record(z.string(), z.string()).default({}),
    kinds: Kinds.default({}),
    suggestedPlugins: ManifestDependencies.default({}),
    /** Absent from the abbreviated document (`application/vnd.npm.install-v1+json`). */
    contents: z.array(VersionContent).optional(),
    manifests: z.array(z.string()).optional(),
    dist: z
      .object({
        /** URL of the archive, absolute or relative to the registry's base URL. */
        tarball: z.string(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        /** npm's Subresource Integrity string, `sha512-<base64>`. */
        integrity: z.string().optional(),
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
    maintainers: z.array(Person).default([]),
    readme: z.string().nullable().default(''),
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
            publisher: z.object({ username: z.string() }).loose().optional(),
            kinds: Kinds.default({}),
          })
          .loose(),
        downloads: z.object({ total: z.number().int().nonnegative().default(0) }).optional(),
      })
      .loose(),
  ),
  total: z.number().int().nonnegative(),
});
export type WireSearch = z.output<typeof WireSearch>;
