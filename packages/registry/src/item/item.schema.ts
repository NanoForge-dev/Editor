import semver from 'semver';
import { z } from 'zod';

/** `@scope/name`: the name of everything in the registry. */
export const ItemName = z
  .string()
  .regex(/^@[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/, 'expected @scope/name, lowercase');
export type ItemName = z.output<typeof ItemName>;

export const ItemType = z.enum(['plugin', 'package']);
export type ItemType = z.output<typeof ItemType>;

/** A version semver reads as is (no `v`, no leading zero, no empty pre-release part). */
export const ItemVersion = z
  .string()
  .refine((version) => semver.valid(version) === version, 'expected a version like 1.2.3');

/** Other registry items an item needs, with version ranges. */
export const Dependencies = z.record(ItemName, z.string());
export type Dependencies = z.output<typeof Dependencies>;

/** Dependencies as a manifest may write them: `["@scope/name"]` (any version) or with ranges. */
export const ManifestDependencies = z.union([
  z.array(ItemName).transform((names) => Object.fromEntries(names.map((name) => [name, '*']))),
  Dependencies,
]);

/** How many contents of each kind a version holds: `{ "@nanoforge/ecs:component": 3 }`. */
export const Kinds = z.record(z.string(), z.number().int().nonnegative());
export type Kinds = z.output<typeof Kinds>;

/** What the registry says of an item in lists. */
export const RegistrySummary = z.object({
  name: ItemName,
  type: ItemType,
  /** The newest version. */
  version: ItemVersion,
  description: z.string().default(''),
  /** Words the manifest gives (`keywords:theme` searches them). */
  keywords: z.array(z.string()).default([]),
  author: z.string().default(''),
  downloads: z.number().int().nonnegative().default(0),
  /** ISO date of the newest version. */
  updatedAt: z.string().default(''),
  /** What the newest version holds, by kind. */
  kinds: Kinds.default({}),
});
export type RegistrySummary = z.output<typeof RegistrySummary>;

/**
 * One content of a published version, as the registry lists it: paths from the archive root,
 * `manifest` naming the sub-manifest it comes from; the API adds `fileCount` and `size`.
 */
export const VersionContent = z
  .object({
    kind: z.string(),
    path: z.string(),
    export: z.string().optional(),
    manifest: z.string().optional(),
    fileCount: z.number().int().nonnegative().optional(),
    size: z.number().int().nonnegative().optional(),
  })
  .loose();
export type VersionContent = z.output<typeof VersionContent>;

export const RegistryVersion = z.object({
  version: ItemVersion,
  publishedAt: z.string().default(''),
  /** sha256 of the archive, hex. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  dependencies: Dependencies.default({}),
  /** What the version needs to run, e.g. `{ "editor": ">=0.1.0" }`. */
  engines: z.record(z.string(), z.string()).default({}),
  /** What the version holds, by kind. */
  kinds: Kinds.default({}),
  /** Editor plugins that make the version easier to use, with ranges. */
  suggestedPlugins: Dependencies.default({}),
  /** What the version holds (root manifest and sub-manifests joined). */
  contents: z.array(VersionContent).default([]),
  /** The sub-manifests its contents were read from. */
  manifests: z.array(z.string()).default([]),
});
export type RegistryVersion = z.output<typeof RegistryVersion>;

export const RegistryItem = RegistrySummary.extend({
  readme: z.string().default(''),
  /** Every version, the newest first. */
  versions: z.array(RegistryVersion).min(1),
});
export type RegistryItem = z.output<typeof RegistryItem>;

export const SearchQuery = z.object({
  type: ItemType.optional(),
  /** Words searched in names and descriptions. */
  q: z.string().default(''),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(30),
});
export type SearchQuery = z.input<typeof SearchQuery>;

export const SearchResult = z.object({
  items: z.array(RegistrySummary),
  total: z.number().int().nonnegative(),
});
export type SearchResult = z.output<typeof SearchResult>;

/** The part of `nanoforge.manifest.json` the installer checks. */
export const ItemManifest = z
  .object({
    type: ItemType,
    name: ItemName,
    version: ItemVersion,
    description: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    dependencies: ManifestDependencies.optional(),
    engines: z.record(z.string(), z.string()).optional(),
    suggestedPlugins: ManifestDependencies.optional(),
  })
  .loose();
export type ItemManifest = z.output<typeof ItemManifest>;

export const MANIFEST_FILE = 'nanoforge.manifest.json';
