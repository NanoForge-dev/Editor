import { BaseRepository } from '../base.repository';
import type { RegistryPackageType } from '../types';

export class RegistryRepository extends BaseRepository {
  getPackage(packageName: string): Promise<RegistryPackageType> {
    return this.get(`/registry/${packageName}`);
  }
}
