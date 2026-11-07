import { describe, expect, it } from 'vitest';

import { type PluginManifestInput, parsePluginManifest } from '../../src/plugin/plugin-manifest';
import type { PluginDescriptor } from '../../src/plugin/plugin-resolution.type';
import type { PluginSourceKind } from '../../src/plugin/plugin-source.enum';
import { resolvePlugins } from '../../src/plugin/resolve-plugins';

const plugin = (
  name: string,
  extra: Partial<PluginManifestInput> = {},
  source: PluginSourceKind = 'bundled',
): PluginDescriptor => ({
  source,
  baseUrl: `/plugins/${name}/`,
  manifest: parsePluginManifest({
    type: 'plugin',
    name,
    version: '1.0.0',
    engines: { editor: '^1.0.0' },
    entry: { client: 'index.js' },
    ...extra,
  }),
});

const resolve = (descriptors: PluginDescriptor[], disabled: string[] = []) =>
  resolvePlugins(descriptors, {
    editorVersion: '1.2.0',
    runtimeVersions: { svelte: '5.57.1' },
    disabled: new Set(disabled),
  });

const statuses = (resolution: ReturnType<typeof resolve>) =>
  Object.fromEntries([...resolution.plugins].map(([name, p]) => [name, p.status.kind]));

const order = (resolution: ReturnType<typeof resolve>) =>
  resolution.order.map((d) => d.manifest.name);

describe('resolvePlugins', () => {
  it('orders dependencies first, deterministically', () => {
    const resolution = resolve([
      plugin('@n/ecs', { dependencies: ['@n/viewport'] }),
      plugin('@n/viewport'),
      plugin('@n/console'),
      plugin('@n/gizmos', { dependencies: { '@n/ecs': '^1.0.0' } }),
    ]);
    expect(order(resolution)).toEqual(['@n/console', '@n/viewport', '@n/ecs', '@n/gizmos']);
  });

  it('uses valid optional dependencies for ordering only', () => {
    const resolution = resolve([
      plugin('@n/a', { optionalDependencies: { '@n/b': '^1.0.0', '@n/missing': '*' } }),
      plugin('@n/b'),
    ]);
    expect(statuses(resolution)).toEqual({ '@n/a': 'ok', '@n/b': 'ok' });
    expect(order(resolution)).toEqual(['@n/b', '@n/a']);
  });

  it('reports missing, mismatched and failed dependencies', () => {
    const resolution = resolve([
      plugin('@n/a', { dependencies: ['@n/missing'] }),
      plugin('@n/b', { dependencies: { '@n/c': '^2.0.0' } }),
      plugin('@n/c'),
      plugin('@n/d', { dependencies: ['@n/a'] }),
      plugin('@n/e', { dependencies: ['@n/d'] }),
    ]);
    expect(statuses(resolution)).toEqual({
      '@n/a': 'missing-dependency',
      '@n/b': 'dependency-version',
      '@n/c': 'ok',
      '@n/d': 'dependency-failed',
      '@n/e': 'dependency-failed',
    });
    expect(order(resolution)).toEqual(['@n/c']);
  });

  it('detects cycles and fails their dependents', () => {
    const resolution = resolve([
      plugin('@n/a', { dependencies: ['@n/b'] }),
      plugin('@n/b', { dependencies: ['@n/a'] }),
      plugin('@n/c', { dependencies: ['@n/a'] }),
    ]);
    expect(resolution.plugins.get('@n/a')!.status).toEqual({
      kind: 'cycle',
      cycle: ['@n/a', '@n/b'],
    });
    expect(statuses(resolution)['@n/c']).toBe('dependency-failed');
  });

  it('checks editor and runtime compatibility', () => {
    const resolution = resolve([
      plugin('@n/old', { engines: { editor: '^0.1.0' } }),
      plugin('@n/newer-svelte', { build: { svelte: '5.60.0' } }),
      plugin('@n/svelte6', { build: { svelte: '6.0.0' } }),
      plugin('@n/fine', { build: { svelte: '5.40.0' } }),
    ]);
    expect(statuses(resolution)).toEqual({
      '@n/old': 'incompatible-editor',
      '@n/newer-svelte': 'incompatible-runtime',
      '@n/svelte6': 'incompatible-runtime',
      '@n/fine': 'ok',
    });
  });

  it('lets dev plugins shadow installed and bundled ones', () => {
    const resolution = resolve([
      plugin('@n/ecs', {}, 'dev'),
      plugin('@n/ecs', {}, 'bundled'),
      plugin('@n/ecs', {}, 'installed'),
    ]);
    expect(resolution.plugins.get('@n/ecs')!.descriptor.source).toBe('dev');
    expect(resolution.shadowed.map((p) => [p.descriptor.source, p.status])).toEqual([
      ['bundled', { kind: 'shadowed', by: 'installed' }],
      ['installed', { kind: 'shadowed', by: 'dev' }],
    ]);
  });

  it('disables plugins and their dependents', () => {
    const resolution = resolve(
      [plugin('@n/a'), plugin('@n/b', { dependencies: ['@n/a'] })],
      ['@n/a'],
    );
    expect(statuses(resolution)).toEqual({ '@n/a': 'disabled', '@n/b': 'dependency-failed' });
  });
});
