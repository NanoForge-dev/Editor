import { z } from 'zod';

/**
 * Where a plugin was found: with the editor, in the user's home (`~/.nanoforge/editor/plugins`),
 * in the open project (`<project>/.nanoforge/plugins`), or a local dev folder.
 */
export const PluginSource = z.enum(['bundled', 'installed', 'project', 'dev']);

/** A plugin package found by the server; the client validates `manifest` with the kernel. */
export const PluginListing = z.object({
  source: PluginSource,
  /** URL (relative to the editor origin) of the plugin package root, ending with `/`. */
  baseUrl: z.string(),
  manifest: z.unknown(),
  /** Set when the manifest file could not be read. */
  error: z.string().optional(),
});
export type PluginListing = z.output<typeof PluginListing>;

/** A plugin that packages in the project's `nf_modules` suggest (`suggestedPlugins`). */
export const PluginSuggestion = z.object({
  name: z.string(),
  /** Every range asked for, by package. */
  suggestedBy: z.array(z.object({ package: z.string(), range: z.string() })),
});
export type PluginSuggestion = z.output<typeof PluginSuggestion>;
