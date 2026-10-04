import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createToken } from '../../src/di/service-token';
import { defineExtensionPoint } from '../../src/extension/define-extension-point';
import {
  type Disposable,
  setDisposableTracker,
  toDisposable,
} from '../../src/lifecycle/disposable';
import { ObservableValue } from '../../src/observable/observable-value';
import { COMMAND_METADATA } from '../../src/plugin/command-metadata';
import { CoreServices } from '../../src/plugin/core-services.const';
import { createCoreContainer } from '../../src/plugin/create-core-container';
import type { AppInfo } from '../../src/plugin/engine-libs';
import { PluginActivationError } from '../../src/plugin/plugin-activation.exception';
import type { PluginContext, PluginModule } from '../../src/plugin/plugin-context.type';
import { PluginHost } from '../../src/plugin/plugin-host';
import { type PluginManifestInput, parsePluginManifest } from '../../src/plugin/plugin-manifest';
import { normalizePluginModule } from '../../src/plugin/plugin-module-loader';
import type { PluginDescriptor } from '../../src/plugin/plugin-resolution.type';

const descriptor = (name: string, extra: Partial<PluginManifestInput> = {}): PluginDescriptor => ({
  source: 'bundled',
  baseUrl: `https://editor.test/plugins/${name}/`,
  manifest: parsePluginManifest({
    type: 'plugin',
    name,
    version: '1.0.0',
    engines: { editor: '^1.0.0' },
    entry: { client: 'index.js' },
    ...extra,
  }),
});

const Greeting = createToken<string>('test.greeting');
const Modes = defineExtensionPoint<string>('test.modes');

const setup = (modules: Record<string, PluginModule>, options: { apps?: AppInfo[] } = {}) => {
  const services = createCoreContainer();
  const apps = new ObservableValue<readonly AppInfo[]>(options.apps ?? []);
  if (options.apps) services.provide(CoreServices.EngineLibs, { apps });
  const loads: string[] = [];
  const host = new PluginHost({
    services,
    editorVersion: '1.0.0',
    activationTimeoutMs: 50,
    loader: {
      load: async (d, generation) => {
        loads.push(`${d.manifest.name}#${generation}`);
        return modules[d.manifest.name] ?? {};
      },
    },
  });
  return { services, host, loads, apps };
};

describe('PluginHost', () => {
  let live: Set<Disposable>;
  beforeEach(() => {
    live = new Set();
    setDisposableTracker({ onCreate: (d) => live.add(d), onDispose: (d) => live.delete(d) });
  });
  afterEach(() => setDisposableTracker(null));

  it('activates startup plugins in dependency order and shares services', async () => {
    const order: string[] = [];
    const { host, services } = setup({
      '@n/b': {
        activate: (ctx) => {
          order.push('b');
          ctx.provide(Greeting, 'hello');
        },
      },
      '@n/a': {
        activate: (ctx) => {
          order.push(`a:${ctx.services.get(Greeting)}`);
        },
      },
      '@n/c': { activate: () => void order.push('c') },
    });
    await host.start([
      descriptor('@n/a', { dependencies: ['@n/b'] }),
      descriptor('@n/b'),
      descriptor('@n/c', { optionalDependencies: { '@n/a': '*' } }),
    ]);
    expect(order).toEqual(['b', 'a:hello', 'c']);
    expect(services.get(Greeting)).toBe('hello');
    expect(host.getPlugins().map((p) => [p.name, p.state])).toEqual([
      ['@n/a', 'active'],
      ['@n/b', 'active'],
      ['@n/c', 'active'],
    ]);
  });

  it('exposes static command contributions before lazy activation, then activates on command', async () => {
    const activate = vi.fn((ctx: PluginContext) => {
      ctx.registerCommand('ecs.addEntity', () => 'added');
    });
    const { host, services } = setup({ '@n/ecs': { activate } });
    await host.start([
      descriptor('@n/ecs', {
        activation: ['onCommand:ecs.addEntity'],
        contributes: { commands: [{ id: 'ecs.addEntity', title: 'Add entity' }] },
      }),
    ]);
    const metadata = services.get(CoreServices.Extensions).getValues(COMMAND_METADATA);
    expect(metadata).toEqual([{ id: 'ecs.addEntity', title: 'Add entity', owner: '@n/ecs' }]);
    expect(activate).not.toHaveBeenCalled();
    await expect(services.get(CoreServices.Commands).execute('ecs.addEntity')).resolves.toBe(
      'added',
    );
    expect(activate).toHaveBeenCalledOnce();
  });

  it('isolates activation failures and timeouts', async () => {
    const { host } = setup({
      '@n/broken': {
        activate: (ctx) => {
          ctx.contribute(Modes, 'leaked');
          throw new Error('boom');
        },
      },
      '@n/slow': { activate: () => new Promise(() => undefined) },
      '@n/fine': { activate: () => undefined },
    });
    await host.start([descriptor('@n/broken'), descriptor('@n/slow'), descriptor('@n/fine')]);
    expect(host.getPlugin('@n/broken')).toMatchObject({ state: 'failed' });
    expect(String(host.getPlugin('@n/slow')!.error)).toMatch(/timed out/);
    expect(host.getPlugin('@n/fine')!.state).toBe('active');
    await expect(host.activate('@n/broken')).rejects.toThrow(PluginActivationError);
  });

  it('does not activate unresolved plugins', async () => {
    const { host } = setup({});
    await host.start([descriptor('@n/a', { dependencies: ['@n/missing'] })]);
    expect(host.getPlugin('@n/a')).toMatchObject({
      state: 'inactive',
      status: { kind: 'missing-dependency' },
    });
    await expect(host.activate('@n/a')).rejects.toThrow(/missing dependency/);
  });

  it('deactivates dependents first and disposes everything the plugin registered', async () => {
    const events: string[] = [];
    const module = (name: string): PluginModule => ({
      activate: (ctx) => {
        ctx.contribute(Modes, name);
        ctx.subscriptions.add(toDisposable(() => events.push(`dispose:${name}`)));
      },
      deactivate: () => void events.push(`deactivate:${name}`),
    });
    const { host, services } = setup({ '@n/base': module('base'), '@n/ext': module('ext') });
    await host.start([descriptor('@n/base'), descriptor('@n/ext', { dependencies: ['@n/base'] })]);
    const extensions = services.get(CoreServices.Extensions);
    expect(extensions.getValues(Modes)).toEqual(['base', 'ext']);

    await host.deactivate('@n/base');
    expect(events).toEqual(['deactivate:ext', 'dispose:ext', 'deactivate:base', 'dispose:base']);
    expect(extensions.getValues(Modes)).toEqual([]);

    host.dispose();
    services.dispose();
    expect(live.size).toBe(0);
  });

  it('hot reloads a plugin and re-activates its dependents', async () => {
    let version = 1;
    const { host, services, loads } = setup({
      '@n/base': { activate: (ctx) => void ctx.provide(Greeting, `v${version}`) },
      '@n/ext': { activate: () => undefined },
    });
    await host.start([descriptor('@n/base'), descriptor('@n/ext', { dependencies: ['@n/base'] })]);
    version = 2;
    await host.reload('@n/base');
    expect(services.get(Greeting)).toBe('v2');
    expect(host.getPlugin('@n/ext')!.state).toBe('active');
    expect(loads).toEqual(['@n/base#0', '@n/ext#0', '@n/base#1']);
  });

  it('updates the plugin set when a project with its own plugins opens and closes', async () => {
    const events: string[] = [];
    const module = (name: string): PluginModule => ({
      activate: (ctx) => {
        events.push(`+${name}@${ctx.source}`);
        ctx.contribute(Modes, name);
      },
      deactivate: () => void events.push(`-${name}`),
    });
    const { host, services } = setup({
      '@n/base': module('base'),
      '@n/tool': module('tool'),
      '@n/local': module('local'),
    });
    const home = [descriptor('@n/base'), descriptor('@n/tool')];
    const project = (name: string, extra: Partial<PluginManifestInput> = {}): PluginDescriptor => ({
      ...descriptor(name, extra),
      source: 'project',
      baseUrl: `https://editor.test/plugins/project/p1/${name}/`,
    });
    await host.start(home);

    await host.update([
      ...home,
      project('@n/tool'),
      project('@n/local', { dependencies: ['@n/base'] }),
    ]);
    expect(host.getPlugin('@n/tool')!.descriptor.source).toBe('project');
    expect(host.getPlugin('@n/local')!.state).toBe('active');
    const modes = () => services.get(CoreServices.Extensions).getValues(Modes).toSorted();
    expect(modes()).toEqual(['base', 'local', 'tool']);

    await host.update(home);
    expect(host.getPlugin('@n/local')).toBeUndefined();
    expect(host.getPlugin('@n/tool')!.descriptor.source).toBe('bundled');
    expect(modes()).toEqual(['base', 'tool']);
    expect(events).toEqual([
      '+base@bundled',
      '+tool@bundled',
      '-tool',
      '+tool@project',
      '+local@project',
      '-tool',
      '-local',
      '+tool@bundled',
    ]);
  });

  it('computes eligible apps and engine lib context keys', async () => {
    let eligible: readonly AppInfo[] = [];
    const client: AppInfo = {
      id: 'client',
      name: 'client',
      type: 'client',
      engineLibs: { '@nanoforge-dev/ecs': '1.4.2', '@nanoforge-dev/graphics-2d': '1.4.2' },
    };
    const server: AppInfo = { id: 'server', name: 'server', type: 'server', engineLibs: {} };
    const { host, services, apps } = setup(
      { '@n/ecs': { activate: (ctx) => void ctx.eligibleApps.subscribe((a) => (eligible = a)) } },
      { apps: [client, server] },
    );
    await host.start([
      descriptor('@n/ecs', { engineLibs: { required: { '@nanoforge-dev/ecs': '^1.4.0' } } }),
    ]);
    expect(eligible.map((app) => app.id)).toEqual(['client']);

    const context = services.get(CoreServices.ContextKeys);
    context.set('activeApp', 'client');
    expect(context.evaluate('plugin.@n/ecs.eligible && engineLib:@nanoforge-dev/graphics-2d')).toBe(
      true,
    );
    context.set('activeApp', 'server');
    expect(context.evaluate('plugin.@n/ecs.eligible || engineLib:@nanoforge-dev/ecs')).toBe(false);

    apps.set([client, { ...server, engineLibs: { '@nanoforge-dev/ecs': '1.5.0' } }]);
    expect(eligible.map((app) => app.id)).toEqual(['client', 'server']);
    expect(context.evaluate('plugin.@n/ecs.eligible')).toBe(true);
  });
});

describe('missingEngineLibs', () => {
  it('handles installed versions, ranges and unknown specs', async () => {
    const { missingEngineLibs } = await import('../../src/plugin/engine-libs');
    const manifest = parsePluginManifest({
      type: 'plugin',
      name: '@n/ecs',
      version: '1.0.0',
      engines: { editor: '*' },
      entry: { client: 'index.js' },
      engineLibs: {
        required: { '@nanoforge-dev/ecs': '^1.4.0', '@nanoforge-dev/input': '^1.0.0' },
      },
    });
    const app = (engineLibs: Record<string, string>): AppInfo => ({
      id: 'a',
      name: 'a',
      type: 'client',
      engineLibs,
    });
    expect(
      missingEngineLibs(
        manifest,
        app({ '@nanoforge-dev/ecs': 'workspace:*', '@nanoforge-dev/input': '^1.2.0' }),
      ),
    ).toEqual([]);
    expect(missingEngineLibs(manifest, app({ '@nanoforge-dev/ecs': '1.3.0' }))).toEqual([
      { name: '@nanoforge-dev/ecs', range: '^1.4.0', installed: '1.3.0' },
      { name: '@nanoforge-dev/input', range: '^1.0.0' },
    ]);
  });
});

describe('normalizePluginModule', () => {
  it('accepts named and default exports', async () => {
    const activate = () => undefined;
    expect(normalizePluginModule({ activate }).activate).toBe(activate);
    expect(normalizePluginModule({ default: { activate } }).activate).toBe(activate);
    expect(normalizePluginModule({ default: 'nope' })).toEqual({});
    expect(normalizePluginModule(undefined)).toEqual({});
  });
});
