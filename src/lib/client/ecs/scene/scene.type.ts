import type { Entity } from './entity/entity.type';

export interface Scene {
  id: string;
  name: string;
  path: string;
  subScenes: string[];
  assets: string[];
  systems: string[];
  entities: Entity[];
}
