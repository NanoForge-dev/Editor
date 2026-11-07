import type { PromptService } from '@nanoforge-dev/editor-sdk/ui';

import type { SceneModel } from '../../model/scene-model.type';
import { parseParam } from '../../model/scene-params';

/** Asks for a scene's params, one prompt per field. `undefined` when cancelled. */
export const askSceneParams = async (
  prompts: PromptService | undefined,
  scene: SceneModel,
): Promise<{ value: unknown } | undefined> => {
  if (!scene.paramsType) return { value: undefined };
  if (!prompts) return undefined;
  if (!scene.params.length) {
    const text = await prompts.ask({
      title: `Load ${scene.id}`,
      label: `Params (${scene.paramsType}, JSON)`,
      value: '{}',
      confirm: 'Load',
    });
    return text === undefined ? undefined : { value: parseParam({ type: 'json' }, text) };
  }
  const value: Record<string, unknown> = {};
  for (const [index, param] of scene.params.entries()) {
    const text = await prompts.ask({
      title: `Load ${scene.id}: ${param.name}`,
      label: `${param.name} (${param.type})`,
      value: param.type === 'number' ? '0' : '',
      confirm: index === scene.params.length - 1 ? 'Load' : 'Next',
      ...(param.optional && { optional: true }),
    });
    if (text === undefined) return undefined;
    if (text !== '' || !param.optional) value[param.name] = parseParam(param, text);
  }
  return { value };
};
