import type { Component, Library, Scene, System } from '$lib/client/ecs';
import type { ComponentPackage, SystemPackage } from '$lib/server/project/package';

import type { Save } from '@utils/types';

export const componentsTransformer = (components: ComponentPackage[]): Component[] =>
  components.map((component) => ({
    id: component.manifest.name,
    name: component.manifest.name,
    path: component.save.path,
    params: component.manifest.params,
  }));

export const systemsTransformer = (systems: SystemPackage[]): System[] =>
  systems.map((system) => ({
    id: system.manifest.name,
    name: system.manifest.name,
    path: system.save.path,
  }));

export const librariesTransformer = (save: Save): Library[] =>
  save.libraries.map((lib) => ({
    id: lib.path,
    name: lib.name,
  }));

export const scenesTransformer = (save: Save): Scene[] => [
  {
    id: 'default',
    name: 'Default',
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
