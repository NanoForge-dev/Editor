import { type AppModel, type Observable, defineExtensionPoint } from '@nanoforge-dev/editor-sdk';

import type { EntryScope } from '../model/ecs-model.type';

/** Where the ECS widgets read and write entities: a file, and the function body in it. */
export interface EcsLocation {
  readonly path: string;
  /** `main` by default; a scene's `setup` is `{ kind: 'method', class, method: 'setup' }`. */
  readonly scope?: EntryScope;
  /** Shown above the hierarchy (`Level1`). */
  readonly label?: string;
  /** The scene id of the location: live entities spawned by that scene carry it. */
  readonly scene?: string;
}

/** A location shown read-only under the edited one (a parent scene's entities). */
export interface InheritedLocation extends EcsLocation {
  readonly label: string;
}

/**
 * What the ECS widgets edit for an app, when it is not the app's `main` (a scene plugin edits
 * the selected scene). The highest `priority` that applies to the app wins.
 */
export interface EcsSource {
  readonly id: string;
  readonly priority: number;
  /** Shown by the widgets while `current` is `undefined`. */
  readonly emptyMessage?: string;
  appliesTo(app: AppModel): boolean;
  /** The edited location; `undefined` while nothing is chosen (`emptyMessage` is shown). */
  current(app: AppModel): Observable<EcsLocation | undefined>;
  /** Read-only locations shown with it, outermost first (the scene's parents). */
  inherited(app: AppModel): Observable<readonly InheritedLocation[]>;
  /** Makes an inherited location the edited one (_Edit this scene_). */
  edit?(app: AppModel, location: InheritedLocation): void;
  /** The location of a scene, by the id live entities carry (live mode, _Apply to code_). */
  locationOf?(app: AppModel, scene: string): EcsLocation | undefined;
}

export const ECS_SOURCES = defineExtensionPoint<EcsSource>('ecs.sources');
