import type { TreeNode } from '@nanoforge-dev/editor-sdk/ui';

import type { AppScenesModel, SceneModel } from '../../model/scene-model.type';

/** The row of the entry file's `main` (not a scene). */
export const MAIN_ID = '#main';

/** What a scene's row says of it: initial, its params, what it lacks. */
export const sceneDetail = (model: AppScenesModel | undefined, scene: SceneModel): string =>
  [
    scene.className === model?.library?.initial ? 'initial' : '',
    scene.paramsType ?? '',
    scene.ecs ? '' : 'not an EcsScene',
    scene.tagged ? '' : 'untagged',
  ]
    .filter(Boolean)
    .join(' · ');

/** The scenes as a tree, by `static parent`, under the entry file's `main`. */
export const sceneTree = (
  model: AppScenesModel | undefined,
  loadedIds: readonly string[],
  mainLabel: string,
): TreeNode[] => {
  const all = model?.scenes ?? [];
  const known = new Set(all.map((scene) => scene.className));
  const children = (parent: string | undefined, seen: Set<string>): TreeNode[] =>
    all
      .filter((scene) =>
        parent === undefined ? !scene.parent || !known.has(scene.parent) : scene.parent === parent,
      )
      .filter((scene) => !seen.has(scene.className))
      .map((scene) => {
        const inner = children(scene.className, new Set([...seen, scene.className]));
        return {
          id: scene.className,
          label: scene.id,
          icon: scene.className === model?.library?.initial ? 'flag' : 'layers',
          detail: [
            loadedIds.at(-1) === scene.id
              ? 'current'
              : loadedIds.includes(scene.id)
                ? 'loaded'
                : '',
            sceneDetail(model, scene),
          ]
            .filter(Boolean)
            .join(' · '),
          ...(loadedIds.includes(scene.id) && { tone: 'added' as const }),
          ...(inner.length && { children: inner }),
          droppable: true,
        };
      });
  const main: TreeNode = {
    id: MAIN_ID,
    label: mainLabel,
    icon: 'file-code',
    detail: 'app: in every scene',
    draggable: false,
    droppable: false,
  };
  return [main, ...children(undefined, new Set())];
};
