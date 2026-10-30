import { defineExtensionPoint } from '@nanoforge-dev/editor-sdk';

/** What an entity action's command is given: the entity, its app, and the file defining it. */
export interface EntityActionTarget {
  readonly app: string;
  readonly entity: string;
  readonly path: string | undefined;
}

/**
 * An extra action on an entity of the Hierarchy (its context menu). The command is run with an
 * {@link EntityActionTarget}; `when` sees `ecsEntity` (the entity's name) and
 * `ecsComponent:<class>` for each of its components (`ecsComponent:Position`).
 */
export interface EntityAction {
  readonly id: string;
  readonly title: string;
  readonly command: string;
  readonly when?: string;
}

export const ENTITY_ACTIONS = defineExtensionPoint<EntityAction>('ecs.entityActions');
