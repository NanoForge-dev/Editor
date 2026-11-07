import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { parsePluginManifest } from '@nanoforge-dev/editor-kernel';

export const MANIFEST_FILE = 'nanoforge.manifest.json';

/** The normalized manifest emitted next to the plugin bundles. */
export interface BuiltManifest {
  readonly name: string;
  readonly version: string;
  readonly build: { readonly svelte?: string; readonly sdk?: string };
  readonly [key: string]: unknown;
}

/** Version of a package as resolved from `root` (undefined when not installed). */
const installedVersion = (root: string, name: string): string | undefined => {
  try {
    const require = createRequire(join(root, 'package.json'));
    return (require(`${name}/package.json`) as { version: string }).version;
  } catch {
    return undefined;
  }
};

/**
 * Reads and validates the plugin manifest, then records the versions of the shared modules the
 * plugin was compiled against (checked by the editor, see docs/adr/0001-plugin-ui-runtime.md).
 */
export const buildManifest = (root: string): BuiltManifest => {
  const path = join(root, MANIFEST_FILE);
  const manifest = parsePluginManifest(JSON.parse(readFileSync(path, 'utf8')), path);
  const svelte = installedVersion(root, 'svelte');
  const sdk = installedVersion(root, '@nanoforge-dev/editor-sdk');
  return {
    ...manifest,
    build: { ...(svelte && { svelte }), ...(sdk && { sdk }) },
  };
};
