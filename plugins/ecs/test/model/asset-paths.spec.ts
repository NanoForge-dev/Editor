import { describe, expect, it } from 'vitest';

import { assetPaths } from '../../src/model/asset-paths';

describe('assetPaths', () => {
  const entries = [
    { path: 'apps/client/assets/textures', kind: 'directory' },
    { path: 'apps/client/assets/textures/hero.PNG', kind: 'file' },
    { path: 'apps/client/assets/music.ogg', kind: 'file' },
    { path: 'apps/client/assets-old/ball.png', kind: 'file' },
    { path: 'apps/client/src/main.ts', kind: 'file' },
  ] as const;

  it('lists the files of the assets folder as the game loads them', () => {
    expect(assetPaths(entries, 'apps/client/assets')).toEqual(['/music.ogg', '/textures/hero.PNG']);
  });

  it('keeps the accepted extensions, whatever their case', () => {
    expect(assetPaths(entries, 'apps/client/assets', ['.png', '.jpg'])).toEqual([
      '/textures/hero.PNG',
    ]);
  });
});
