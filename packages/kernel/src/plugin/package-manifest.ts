import { z } from 'zod';

import { PluginDependencies, PluginName, Version } from './manifest-fields';

const SubFolder = z
  .string()
  .min(1)
  .refine((path) => !path.startsWith('/') && !path.split(/[\\/]/).includes('..'), {
    message: 'must be a sub-folder of the package',
  });

/**
 * `nanoforge.manifest.json` of a package of type `package`, installed in `nf_modules`: the fields
 * the editor reads today. Items and owner objects (ADR 0003) are kept as they are.
 * A package never holds a plugin: plugins are installed apart (`.nanoforge/plugins`).
 */
export const PackageManifestSchema = z
  .object({
    $schema: z.string().optional(),
    type: z.literal('package'),
    name: PluginName,
    version: Version,
    description: z.string().optional(),
    /** Sub-folders holding their own `package` manifest. Walked, never scanned. */
    include: z.array(SubFolder).default([]),
    /** Editor plugins that make this package easier to use: the editor offers them. */
    suggestedPlugins: PluginDependencies,
  })
  .loose();

export type PackageManifest = z.output<typeof PackageManifestSchema>;
