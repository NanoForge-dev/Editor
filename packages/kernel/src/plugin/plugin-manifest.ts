import { z } from 'zod';

import {
  ActivationEvent,
  EntryPath,
  NpmRanges,
  PluginDependencies,
  PluginName,
  Range,
  Version,
} from './manifest-fields';
import { PluginManifestError } from './plugin-manifest.exception';

const CommandContribution = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().optional(),
  icon: z.string().optional(),
  when: z.string().optional(),
  /** `false`: not listed in the command palette (the command needs arguments). */
  palette: z.boolean().optional(),
});

/**
 * `nanoforge.manifest.json` of a package of type `plugin`.
 * Contributions other than `commands` are validated by the service that owns them
 * (settings, widgets, menus…) through contribution handlers.
 */
export const PluginManifestSchema = z.object({
  $schema: z.string().optional(),
  type: z.literal('plugin'),
  name: PluginName,
  version: Version,
  displayName: z.string().min(1).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  /** Words the registry searches (`keywords:theme`): a theme plugin says `theme`. */
  keywords: z.array(z.string()).default([]),
  icon: EntryPath.optional(),
  license: z.string().optional(),
  repository: z.string().optional(),

  engines: z.object({ editor: Range }),
  dependencies: PluginDependencies,
  optionalDependencies: PluginDependencies,
  engineLibs: z
    .object({ required: NpmRanges, optional: NpmRanges })
    .default({ required: {}, optional: {} }),

  /** None for a plugin that only contributes from its manifest (a theme, icons). */
  entry: z
    .object({
      client: EntryPath.optional(),
      server: EntryPath.optional(),
      worker: EntryPath.optional(),
    })
    .default({}),
  /** Defaults to `["onStartup"]`. */
  activation: z.array(ActivationEvent).default(['onStartup']),
  contributes: z
    .object({
      commands: z.array(CommandContribution).default([]),
      /** The plugin owns item data (ADR 0003): its tags, and the version of its owner object. */
      itemOwner: z
        .object({
          schema: z.number().int().positive(),
          tags: z.array(z.string().regex(/^[a-z][A-Za-z0-9]*$/)).default([]),
        })
        .optional(),
    })
    .catchall(z.unknown())
    .default({ commands: [] }),

  /** Filled by `@nanoforge-dev/editor-vite-plugin` at build time. */
  build: z.object({ svelte: Version.optional(), sdk: Version.optional() }).default({}),
});

export type PluginManifest = z.output<typeof PluginManifestSchema>;

export type PluginManifestInput = z.input<typeof PluginManifestSchema>;
export type CommandContribution = z.output<typeof CommandContribution>;

export const parsePluginManifest = (value: unknown, location?: string): PluginManifest => {
  const result = PluginManifestSchema.safeParse(value);
  if (result.success) return result.data;
  throw new PluginManifestError(
    result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    location,
  );
};

/**
 * JSON Schema of the manifest, for editor completion (`$schema` in manifests). `contributes`
 * gives the schemas of contribution keys handled above the kernel (`themes`, `iconThemes`…).
 */
export const pluginManifestJsonSchema = (contributes: Record<string, z.ZodType> = {}): unknown => {
  const schema = z.toJSONSchema(PluginManifestSchema, {
    io: 'input',
    unrepresentable: 'any',
  }) as unknown as {
    properties: { contributes: { properties: Record<string, unknown> } };
  };
  for (const [key, value] of Object.entries(contributes)) {
    const part: Record<string, unknown> = {
      ...z.toJSONSchema(value, { io: 'input', unrepresentable: 'any' }),
    };
    delete part.$schema;
    schema.properties.contributes.properties[key] = part;
  }
  return schema;
};
