import type { ContextKeyService } from '@nanoforge-dev/editor-sdk';
import type { MenuEntry } from '@nanoforge-dev/editor-sdk/ui';

import type {
  EntityAction,
  EntityActionTarget,
} from '../../extension/entity-action.extension-point';
import type { EntityModel } from '../../model/ecs-model.type';

/**
 * The menu entries of the `ecs.entityActions` whose `when` holds for an entity (after a
 * separator), each running its command with the entity as target. An action whose `when` can't
 * be read is left out.
 */
export const entityActionEntries = (
  actions: readonly EntityAction[],
  entity: EntityModel,
  target: EntityActionTarget,
  contextKeys: Pick<ContextKeyService, 'createScoped'>,
  run: (command: string, target: EntityActionTarget) => unknown,
): MenuEntry[] => {
  if (!actions.length) return [];
  const scope = contextKeys.createScoped('ecs.hierarchy.entity');
  scope.set('ecsEntity', entity.name);
  for (const component of entity.components)
    if (component.className) scope.set(`ecsComponent:${component.className}`, true);
  const shown = actions.filter((action) => {
    try {
      return scope.evaluate(action.when);
    } catch {
      return false;
    }
  });
  scope.dispose();
  if (!shown.length) return [];
  return [
    { kind: 'separator' },
    ...shown.map((action): MenuEntry => ({
      kind: 'item',
      id: `action-${action.id}`,
      label: action.title,
      onSelect: () => void run(action.command, target),
    })),
  ];
};
