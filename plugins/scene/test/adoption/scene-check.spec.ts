import { describe, expect, it } from 'vitest';

import { sceneModuleSpec, withSceneModule } from '../../src/adoption/scene-check';

const pkg = (dependencies: Record<string, string>) =>
  JSON.stringify({ name: 'pong-client', dependencies });

describe('the scene module in package.json', () => {
  it("never takes the engine core's spec", () => {
    expect(
      sceneModuleSpec(
        [
          {
            path: 'apps/server/package.json',
            text: pkg({ '@nanoforge-dev/core': 'link:../../../engine/packages/core' }),
          },
        ],
        'apps/client',
      ),
    ).toBeUndefined();
  });

  it("rebases another package.json's link on the app's folder", () => {
    expect(
      sceneModuleSpec(
        [
          {
            path: 'package.json',
            text: pkg({ '@nanoforge-dev/scene': 'link:../engine/modules/scene' }),
          },
        ],
        'apps/client',
      ),
    ).toBe('link:../../../engine/modules/scene');
    expect(
      sceneModuleSpec(
        [{ path: 'apps/server/package.json', text: pkg({ '@nanoforge-dev/scene': '^1.2.0' }) }],
        'apps/client',
      ),
    ).toBe('^1.2.0');
  });

  it('writes the spec it is given, sorted with the others', () => {
    const text = withSceneModule(
      pkg({
        '@nanoforge-dev/core': 'link:../engine/packages/core',
        '@nanoforge-dev/ecs': '^1.0.0',
      }),
      'link:../engine/modules/scene',
    );
    expect(Object.entries(JSON.parse(text).dependencies)).toEqual([
      ['@nanoforge-dev/core', 'link:../engine/packages/core'],
      ['@nanoforge-dev/ecs', '^1.0.0'],
      ['@nanoforge-dev/scene', 'link:../engine/modules/scene'],
    ]);
  });
});
