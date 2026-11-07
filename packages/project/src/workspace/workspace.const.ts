import type { NewApp } from './workspace.type';

export const PACKAGE_NAME = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
export const FOLDER = /^[a-z0-9][a-z0-9-]*$/;
export const CODE = /\.(?:[cm]?[jt]sx?)$/;
export const WORKSPACE_CONFIG = 'nanoforge.config.ts';
export const TSCONFIG = 'tsconfig.json';

export const CONFIG_NAMES = [
  'nanoforge.config.ts',
  'nanoforge.config.mts',
  'nanoforge.config.js',
  'nanoforge.config.mjs',
];

export const LIB_CONFIG = [
  'import { defineConfig } from "@nanoforge-dev/config";',
  '',
  'export default defineConfig({',
  '  type: "lib",',
  '  dir: { components: "src/components", systems: "src/systems", scenes: "src/scenes" },',
  '});',
  '',
].join('\n');

export const ENGINE_BASE = ['asset', 'common', 'core', 'env', 'ecs'].map(
  (name) => `@nanoforge-dev/${name}`,
);

/** The engine library a game registers to be driven by the editor (engine 2.0 and later). */
export const EDITOR_LIBRARY = '@nanoforge-dev/editor-lib';

export const MAIN: Record<NewApp['type'], string> = {
  client: [
    'import type { ClientRunOptions } from "@nanoforge-dev/common";',
    'import { NanoforgeFactory } from "@nanoforge-dev/core";',
    'import { EcsLibrary } from "@nanoforge-dev/ecs/client";',
    '',
    'export const main = async (options: ClientRunOptions): Promise<void> => {',
    '  const app = NanoforgeFactory.createClient({ tickRate: 60 });',
    '  const ecs = new EcsLibrary();',
    '',
    '  app.use(ecs);',
    '',
    '  await app.init(options);',
    '',
    '  const registry = ecs.registry;',
    '  void registry;',
    '',
    '  await app.run();',
    '};',
    '',
  ].join('\n'),
  server: [
    'import type { RunOptions } from "@nanoforge-dev/common";',
    'import { NanoforgeFactory } from "@nanoforge-dev/core";',
    'import { EcsLibrary } from "@nanoforge-dev/ecs/server";',
    '',
    'export const main = async (options: RunOptions): Promise<void> => {',
    '  const app = NanoforgeFactory.createServer({ tickRate: 60 });',
    '  const ecs = new EcsLibrary();',
    '',
    '  app.use(ecs);',
    '',
    '  await app.init(options);',
    '',
    '  const registry = ecs.registry;',
    '  void registry;',
    '',
    '  await app.run();',
    '};',
    '',
  ].join('\n'),
};
