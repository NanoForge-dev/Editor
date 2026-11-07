import type { CommandMetadata } from '../command/command.type';
import type { Container } from '../di/container';
import type { Validator } from '../extension/extension-point.type';
import type { Disposable } from '../lifecycle/disposable';
import type { PluginModule } from './plugin-context.type';
import type { PluginDescriptor, PluginStatus, ResolveOptions } from './plugin-resolution.type';

export type PluginState = 'inactive' | 'activating' | 'active' | 'deactivating' | 'failed';

export interface PluginInfo {
  readonly name: string;
  readonly descriptor: PluginDescriptor;
  readonly status: PluginStatus;
  readonly state: PluginState;
  readonly error?: unknown;
}

export interface PluginModuleLoader {
  /** Imports the client entry. `generation` changes on hot reload to bypass module caches. */
  load(descriptor: PluginDescriptor, generation: number): Promise<PluginModule>;
}

/**
 * Handles a static `contributes.<key>` section of manifests. Static contributions are applied
 * for every resolved plugin before activation, so the UI can show commands, widgets or settings
 * of plugins that activate lazily.
 */
export interface StaticContributionHandler<T = unknown> {
  readonly key: string;
  readonly validator?: Validator<T>;
  apply(value: T, plugin: PluginDescriptor): Disposable;
}

export interface CommandMetadataContribution extends CommandMetadata {
  readonly id: string;
  readonly owner: string;
}

export interface PluginHostOptions extends ResolveOptions {
  /** Editor-wide container; plugin scopes are created as its children. */
  services: Container;
  loader?: PluginModuleLoader;
  activationTimeoutMs?: number;
}
