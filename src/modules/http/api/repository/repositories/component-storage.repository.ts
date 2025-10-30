import { BaseRepository } from '../base.repository';

export class ComponentStorageRepository extends BaseRepository {
  getManifest(componentCode: string): Promise<Response> {
    return this.get(`/components/storage/${componentCode}/manifest`);
  }
}
