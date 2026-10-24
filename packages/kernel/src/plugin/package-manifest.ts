import { z } from 'zod';

import { PluginDependencies, PluginName, Version } from './manifest-fields';

const InsidePath = z
  .string()
  .min(1)
  .refine((path) => !path.startsWith('/') && !path.split(/[\\/]/).includes('..'), {
    message: 'must be a path inside the package',
  });

/**
 * `nanoforge.manifest.json` of a package of type `package`, installed in `nf_modules`: the fields
 * the editor reads today. `contents`, items and owner objects (ADR 0003) are kept as they are:
 * `readPackageContents` (`@nanoforge-dev/registry/types`) reads `contents` with the
 * sub-manifests' ones. A package never holds a plugin: plugins are installed apart
 * (`.nanoforge/plugins`).
 */
export const PackageManifestSchema = z
  .object({
    $schema: z.string().optional(),
    type: z.literal('package'),
    name: PluginName,
    version: Version,
    description: z.string().optional(),
    /**
     * Sub-manifests describing more contents: folders (their `nanoforge.manifest.json`) or `.json`
     * files. They only hold `contents` and `include`. Walked, never scanned.
     */
    include: z.array(InsidePath).default([]),
    /** Editor plugins that make this package easier to use: the editor offers them. */
    suggestedPlugins: PluginDependencies,
  })
  .loose();

export type PackageManifest = z.output<typeof PackageManifestSchema>;
