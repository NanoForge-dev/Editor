import { describe, expect, it } from 'vitest';

import { parsePluginManifest } from '../../src/plugin/plugin-manifest';
import { PluginManifestError } from '../../src/plugin/plugin-manifest.exception';

const base = {
  type: 'plugin',
  name: '@nanoforge/ecs',
  version: '1.0.0',
  engines: { editor: '^1.0.0' },
  entry: { client: 'dist/index.js' },
};

describe('parsePluginManifest', () => {
  it('applies defaults', () => {
    const manifest = parsePluginManifest(base);
    expect(manifest).toMatchObject({
      activation: ['onStartup'],
      dependencies: {},
      engineLibs: { required: {}, optional: {} },
      contributes: { commands: [] },
      tags: [],
    });
  });

  it('accepts CLI-style dependency arrays and keeps unknown contributions', () => {
    const manifest = parsePluginManifest({
      ...base,
      dependencies: ['@nanoforge/viewport'],
      optionalDependencies: { '@nanoforge/graphics-gizmos': '^2.0.0' },
      engineLibs: { required: { '@nanoforge-dev/ecs': '^1.4.0' } },
      contributes: { commands: [{ id: 'ecs.addEntity', title: 'Add entity' }], widgets: [{}] },
    });
    expect(manifest.dependencies).toEqual({ '@nanoforge/viewport': '*' });
    expect(manifest.engineLibs).toEqual({
      required: { '@nanoforge-dev/ecs': '^1.4.0' },
      optional: {},
    });
    expect(manifest.contributes.widgets).toEqual([{}]);
  });

  it('reports every issue with its path', () => {
    const invalid = {
      ...base,
      name: 'NoScope',
      version: 'one',
      engines: { editor: 'latest!' },
      entry: { client: '../escape.js' },
      activation: ['whenever'],
    };
    try {
      parsePluginManifest(invalid, 'plugins/bad');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PluginManifestError);
      const paths = (error as PluginManifestError).issues.map((issue) => issue.path);
      expect(paths).toEqual(
        expect.arrayContaining([
          'name',
          'version',
          'engines.editor',
          'entry.client',
          'activation.0',
        ]),
      );
      expect((error as Error).message).toContain('plugins/bad');
    }
  });

  it('requires at least one entry', () => {
    expect(() => parsePluginManifest({ ...base, entry: {} })).toThrow(/at least one/);
  });
});
