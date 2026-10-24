import type { PluginManifest } from './plugin-manifest';
import type { PluginSourceKind } from './plugin-source.enum';

export interface PluginDescriptor {
  readonly manifest: PluginManifest;
  readonly source: PluginSourceKind;
  /** URL of the plugin package root, entry paths are resolved against it. */
  readonly baseUrl: string;
}

export type PluginStatus =
  | { kind: 'ok' }
  | { kind: 'disabled' }
  | { kind: 'shadowed'; by: PluginSourceKind }
  | { kind: 'incompatible-editor'; required: string; actual: string }
  | { kind: 'incompatible-runtime'; module: string; compiled: string; actual: string }
  | { kind: 'missing-dependency'; dependency: string; range: string }
  | { kind: 'dependency-version'; dependency: string; range: string; actual: string }
  | { kind: 'dependency-failed'; dependency: string }
  | { kind: 'cycle'; cycle: readonly string[] };

export interface ResolveOptions {
  editorVersion: string;
  /** Versions of the shared runtime modules of the host, e.g. `{ svelte: '5.57.1' }`. */
  runtimeVersions?: Readonly<Record<string, string>>;
  disabled?: ReadonlySet<string>;
}

export interface ResolvedPlugin {
  readonly descriptor: PluginDescriptor;
  readonly status: PluginStatus;
}

export interface Resolution {
  /** Every candidate by name (the winning source for shadowed names). */
  readonly plugins: ReadonlyMap<string, ResolvedPlugin>;
  /** Plugins shadowed by another source. */
  readonly shadowed: readonly ResolvedPlugin[];
  /** `ok` plugins in activation order: dependencies (and present optional ones) first. */
  readonly order: readonly PluginDescriptor[];
}
