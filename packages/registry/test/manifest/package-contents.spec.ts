import { describe, expect, it } from 'vitest';

import { countKinds, readPackageContents } from '../../src';

/** A package as files: path → JSON. */
const reader = (files: Record<string, unknown>) => async (path: string) => files[path];

describe('readPackageContents', () => {
  it('joins the contents of the sub-manifests, with paths from the package root', async () => {
    const found = await readPackageContents(
      {
        name: '@acme/kit',
        contents: [{ kind: 'asset', path: 'assets/' }],
        include: ['src/player', 'data/assets.json'],
      },
      reader({
        'src/player/nanoforge.manifest.json': {
          contents: [
            {
              kind: '@nanoforge/ecs:component',
              path: 'velocity.ts',
              export: 'Velocity',
              '@nanoforge/ecs': { type: 'component' },
            },
          ],
          include: ['ai/'],
        },
        'src/player/ai/nanoforge.manifest.json': {
          contents: [{ kind: '@nanoforge/ecs:system', path: 'chase.ts' }],
        },
        'data/assets.json': { contents: [{ kind: 'asset', path: 'music.ogg' }] },
      }),
    );
    expect(found.problems).toEqual([]);
    expect(found.manifests).toEqual([
      'src/player/nanoforge.manifest.json',
      'data/assets.json',
      'src/player/ai/nanoforge.manifest.json',
    ]);
    expect(found.contents).toEqual([
      { kind: 'asset', path: 'assets/' },
      {
        kind: '@nanoforge/ecs:component',
        path: 'src/player/velocity.ts',
        export: 'Velocity',
        '@nanoforge/ecs': { type: 'component' },
        manifest: 'src/player/nanoforge.manifest.json',
      },
      { kind: 'asset', path: 'data/music.ogg', manifest: 'data/assets.json' },
      {
        kind: '@nanoforge/ecs:system',
        path: 'src/player/ai/chase.ts',
        manifest: 'src/player/ai/nanoforge.manifest.json',
      },
    ]);
    expect(countKinds(found.contents)).toEqual({
      asset: 2,
      '@nanoforge/ecs:component': 1,
      '@nanoforge/ecs:system': 1,
    });
  });

  it('skips what the registry refuses, and says why', async () => {
    const found = await readPackageContents(
      {
        contents: [
          { kind: 'Bad Kind', path: 'a.ts' },
          { kind: 'file', path: '../outside.ts' },
          { kind: 'file', path: 'ok.ts' },
        ],
        include: ['../up', 'missing', 'self.json', 'self.json'],
      },
      reader({ 'self.json': { include: ['nanoforge.manifest.json'] } }),
    );
    expect(found.contents).toEqual([{ kind: 'file', path: 'ok.ts' }]);
    expect(found.manifests).toEqual(['self.json']);
    expect(found.problems).toEqual([
      expect.stringContaining('contents[0].kind'),
      expect.stringContaining('contents[1].path'),
      expect.stringContaining('include[0]'),
      expect.stringContaining('self.json is included twice'),
      'missing/nanoforge.manifest.json: missing, or not a JSON object',
      expect.stringContaining('nanoforge.manifest.json is included twice'),
    ]);
  });

  it('stops past four levels', async () => {
    const files: Record<string, unknown> = {};
    let dir = '';
    for (let depth = 1; depth <= 5; depth++) {
      dir += `l${depth}/`;
      files[`${dir}nanoforge.manifest.json`] = {
        contents: [{ kind: 'file', path: 'x.ts' }],
        include: [`l${depth + 1}`],
      };
    }
    const found = await readPackageContents({ include: ['l1'] }, reader(files));
    expect(found.manifests).toHaveLength(4);
    expect(found.problems).toEqual(['sub-manifests nest at most 4 levels deep']);
  });
});
