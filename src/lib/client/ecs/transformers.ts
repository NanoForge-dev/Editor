import type { ComponentPkg, SystemPkg } from '$lib/client/action';
import type { Component, Library, Scene, System } from '$lib/client/ecs';

import type { Save, SaveLibrary } from '@utils/types';

export const componentTransformer = (component: ComponentPkg): Component => ({
  id: component.manifest.id,
  name: component.manifest.name,
  path: component.save.path,
  params: component.manifest.params,
});

export const componentsTransformer = (components: ComponentPkg[]): Component[] =>
  components.map(componentTransformer);

export const systemTransformer = (system: SystemPkg): System => ({
  id: system.manifest.id,
  name: system.manifest.name,
  path: system.save.path,
});

export const systemsTransformer = (systems: SystemPkg[]): System[] =>
  systems.map(systemTransformer);

export const libraryTransformer = (lib: SaveLibrary): Library => ({
  id: lib.path,
  name: lib.name,
});

export const librariesTransformer = (save: Save): Library[] =>
  save.libraries.map(libraryTransformer);

export const scenesTransformer = (save: Save): Scene[] => [
  {
    id: 'default',
    name: 'Default Scene',
    path: 'unknown',
    subScenes: [],
    assets: [],
    systems: save.systems.map((system) => system.name),
    entities: save.entities.map((entity) => ({
      id: entity.id,
      name: entity.id,
      treePath: entity.treePath,
      components: entity.components,
    })),
  },
];
