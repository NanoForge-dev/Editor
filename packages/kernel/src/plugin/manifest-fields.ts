import semver from 'semver';
import { z } from 'zod';

/** Registry package name: `@scope/name`, like a scoped npm package. */
export const PLUGIN_NAME_PATTERN = /^@[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/;

export const PluginName = z
  .string()
  .regex(PLUGIN_NAME_PATTERN, 'must be "@scope/name" (lowercase letters, digits, dashes)');

export const Version = z
  .string()
  .refine((value) => semver.valid(value) !== null, 'invalid semver version');

export const Range = z
  .string()
  .refine((value) => semver.validRange(value) !== null, 'invalid semver range');

/** `["a/b"]` (any version, CLI registry style) or `{ "a/b": "^1.0.0" }`. */
export const PluginDependencies = z
  .union([
    z.array(PluginName).transform((names) => Object.fromEntries(names.map((name) => [name, '*']))),
    z.record(PluginName, Range),
  ])
  .default({});

export const NpmRanges = z.record(z.string().min(1), Range).default({});

export const ACTIVATION_EVENT_PATTERN =
  /^(onStartup|on(Command|Screen|Widget|ProjectType|Language|Uri):.+)$/;

export const ActivationEvent = z
  .string()
  .regex(
    ACTIVATION_EVENT_PATTERN,
    'expected onStartup, onCommand:<id>, onScreen:<id>, onWidget:<id>, onProjectType:<type>, onLanguage:<id> or onUri:<scheme>',
  );

export const EntryPath = z
  .string()
  .min(1)
  .refine((path) => !path.startsWith('/') && !path.split('/').includes('..'), {
    message: 'must be a relative path inside the plugin package',
  });
