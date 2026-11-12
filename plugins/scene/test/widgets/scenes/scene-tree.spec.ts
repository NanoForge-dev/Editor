import { describe, expect, it } from 'vitest';

import type { TreeNode } from '@nanoforge-dev/editor-sdk/ui';

import type { SceneModel } from '../../../src/model/scene-model.type';
import { MAIN_ID, sceneTree } from '../../../src/widgets/scenes/scene-tree';

const scene = (className: string, path: string, parent?: string): SceneModel => ({
  id: className,
  className,
  path,
  line: 1,
  ...(parent && { parent }),
  ecs: true,
  ownSetup: false,
  params: [],
  tagged: false,
  vars: [],
});

const ids = (nodes: readonly TreeNode[]): string[] =>
  nodes.flatMap((node) => [node.id, ...ids(node.children ?? [])]);

describe('sceneTree', () => {
  it('shows a class name once when two files export it (a scene being renamed)', () => {
    const nodes = sceneTree(
      {
        scenes: [
          scene('Run', 'scenes/run.ts'),
          scene('Extra', 'scenes/bonus.ts', 'Run'),
          scene('Extra', 'scenes/extra.ts', 'Run'),
        ],
        problems: [],
      },
      [],
      'main',
    );
    expect(ids(nodes)).toEqual([MAIN_ID, 'Run', 'Extra']);
  });
});
