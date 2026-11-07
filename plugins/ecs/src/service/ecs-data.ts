import {
  type AppModel,
  type CatalogItem,
  type Observable,
  type ProjectModel,
  appRefName,
} from '@nanoforge-dev/editor-sdk';

import type { EcsLocation, InheritedLocation } from '../extension/ecs-source.extension-point';
import type { EcsItemData, EntryModel, EntryRoot } from '../model/ecs-model.type';
import { ECS_KEY } from '../model/ecs.const';

export const ACTIVE_APP_KEY = 'activeApp';
/** Undo context of moves and copies between apps and shared libraries. */
export const REFACTORS_HISTORY = 'ecs:refactors';
export const SHOWN_STORAGE_KEY = 'nanoforge.ecs.shown';
export const REFRESH_DELAY_MS = 120;

/** Apps whose scene the plugin edits: an entry file and the ECS engine library. */
export const ecsApps = (model: ProjectModel | undefined): AppModel[] =>
  (model?.apps ?? []).filter(
    (app) => app.type !== 'lib' && !!app.entryFile && '@nanoforge-dev/ecs' in app.engineLibs,
  );

export const ecsData = (item: CatalogItem | undefined): EcsItemData | undefined =>
  item?.meta[ECS_KEY] as EcsItemData | undefined;

/** A parent scene's entities and systems, shown read-only (see `ecs.sources`). */
export interface InheritedModel {
  readonly location: InheritedLocation;
  readonly model: EntryModel;
}

/** Where each source's items come from, for the analyzer's item references. */
export const rootsOf = (model: ProjectModel, paths: readonly string[]): EntryRoot[] => [
  ...model.apps.map((app) => ({
    path: app.root,
    ref: app.type === 'lib' ? app.name : `app:${appRefName(app)}`,
  })),
  ...paths
    .filter((path) => /^nf_modules\/@[^/]+\/[^/]+$/.test(path))
    .map((path) => ({ path, ref: path.slice('nf_modules/'.length) })),
];

export const sameLocation = (a: EcsLocation | undefined, b: EcsLocation | undefined): boolean =>
  a?.path === b?.path && JSON.stringify(a?.scope) === JSON.stringify(b?.scope);

export const readShown = (): Record<string, string[]> => {
  try {
    const raw = localStorage.getItem(SHOWN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
};

/** The values of an extension point's contributions. */
export const values = <T>(
  contributions: Observable<readonly { readonly value: T }[]>,
): Observable<T[]> => ({
  get: () => contributions.get().map((contribution) => contribution.value),
  subscribe: (run) =>
    contributions.subscribe((list) => run(list.map((contribution) => contribution.value))),
});
