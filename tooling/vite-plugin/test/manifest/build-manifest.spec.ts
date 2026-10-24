import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildManifest } from '../../src/manifest/build-manifest';

const pluginDir = (manifest: object) => {
  const root = mkdtempSync(join(tmpdir(), 'nf-plugin-'));
  writeFileSync(join(root, 'package.json'), '{"name":"fixture"}');
  writeFileSync(join(root, 'nanoforge.manifest.json'), JSON.stringify(manifest));
  const svelte = join(root, 'node_modules', 'svelte');
  mkdirSync(svelte, { recursive: true });
  writeFileSync(join(svelte, 'package.json'), '{"name":"svelte","version":"5.50.0"}');
  return root;
};

describe('buildManifest', () => {
  it('validates the manifest and records the svelte version', () => {
    const root = pluginDir({
      type: 'plugin',
      name: '@nanoforge/fixture',
      version: '0.1.0',
      engines: { editor: '^0.1.0' },
      entry: { client: 'index.js' },
    });
    expect(buildManifest(root)).toMatchObject({
      name: '@nanoforge/fixture',
      activation: ['onStartup'],
      build: { svelte: '5.50.0' },
    });
  });

  it('fails the build on invalid manifests', () => {
    const root = pluginDir({ type: 'plugin', name: 'bad' });
    expect(() => buildManifest(root)).toThrow(/Invalid plugin manifest/);
  });
});
