import { describe, expect, it } from 'vitest';

import type { ItemOwner } from '@nanoforge-dev/editor-meta';

import { CodeEngine } from '../../src/engine';

const ecs: ItemOwner = {
  name: '@nanoforge/ecs',
  version: '0.0.0',
  schema: 1,
  tags: ['component', 'system'],
  claims: ({ kind }) => (kind === 'function' ? { params: ['registry'] } : { fields: ['name'] }),
  extract: ({ declaration, context, tags }) => {
    if (tags.component) return { type: 'component', name: declaration.getName() };
    const query = declaration
      .getDescendants()
      .filter(
        (node) =>
          node.getKindName() === 'Identifier' &&
          node.getParent()?.getKindName() === 'CallExpression' &&
          node.getText() !== 'use',
      )
      .map((node) => context.refOf(node));
    return { type: 'system', query };
  },
};

const engine = () => {
  const code = new CodeEngine();
  code.registerItemOwner(ecs, '@nanoforge/ecs');
  code.setTsconfig(
    '{ "compilerOptions": { "paths": { "@me/shared/*": ["./libs/shared/src/*"] } } }',
  );
  code.setFiles([
    {
      path: 'libs/shared/src/components/player.ts',
      text: '/** A player. @component */\nexport class Player { name = "Player"; constructor(public id = "") {} }',
    },
    {
      path: 'apps/client/src/systems/greet.ts',
      text: [
        'import { Player } from "@me/shared/components/player";',
        'declare const use: (c: unknown) => void;',
        '/** Greets players. @system @side client */',
        'export function greet(registry: unknown) { use(Player); }',
      ].join('\n'),
    },
  ]);
  return code;
};

const roots = [
  { path: 'libs/shared', ref: '@me/shared' },
  { path: 'apps/client', ref: 'app:client' },
];

describe('CodeEngine.extractMeta', () => {
  it('extracts items with owners and resolves package-name imports through tsconfig paths', async () => {
    const code = engine();
    const lib = await code.extractMeta({
      source: { kind: 'lib', name: '@me/shared', path: 'libs/shared' },
      files: [{ path: 'libs/shared/src/components/player.ts', folder: 'components' }],
      roots,
    });
    expect(lib.items).toMatchObject([
      { export: 'Player', fields: [], '@nanoforge/ecs': { type: 'component', name: 'Player' } },
    ]);
    expect(lib.owners).toEqual({ '@nanoforge/ecs': { version: '0.0.0', schema: 1 } });
    expect(lib.sourceHash).toMatch(/^sha256-[0-9a-f]{64}$/);

    const app = await code.extractMeta({
      source: { kind: 'app', name: 'client', path: 'apps/client' },
      files: [{ path: 'apps/client/src/systems/greet.ts', folder: 'systems' }],
      roots,
    });
    expect(app.items[0]).toMatchObject({
      export: 'greet',
      side: 'client',
      params: [],
      requires: ['@me/shared'],
      '@nanoforge/ecs': { type: 'system', query: ['@me/shared#Player'] },
    });
    expect(await code.diagnostics(['apps/client/src/systems/greet.ts'])).toEqual([]);
  });

  it('drops the owners of an unloaded plugin', () => {
    const code = engine();
    code.unregisterOwner('@nanoforge/ecs');
    expect(code.itemOwners).toEqual([]);
  });
});

describe('moduleSpecifierFor', () => {
  it('uses tsconfig paths, else a relative path', async () => {
    const { moduleSpecifierFor } = await import('../../src/engine');
    const paths = { '@me/shared/*': ['libs/shared/src/*'] };
    expect(
      moduleSpecifierFor('apps/client/src/main.ts', 'libs/shared/src/components/player.ts', paths),
    ).toBe('@me/shared/components/player');
    expect(
      moduleSpecifierFor(
        'apps/client/src/main.ts',
        'apps/client/src/components/components.ts',
        paths,
      ),
    ).toBe('./components/components');
    expect(moduleSpecifierFor('apps/client/src/main.ts', 'nf_modules/@a/b/x.ts', paths)).toBe(
      '../../../nf_modules/@a/b/x',
    );
  });
});
