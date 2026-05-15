import { BaseRepository } from '../base.repository';
import type { RegistryComponentType } from '../types';

export class RegistryRepository extends BaseRepository {
  getComponent(packageName: string): Promise<RegistryComponentType> {
    return this.get(`/registry/${packageName}`);
  }
}
