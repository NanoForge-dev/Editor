import { BaseRepository } from '../base.repository';
import type { Archive } from '../types';

export class ProjectArchiveRepository extends BaseRepository {
  create(): Promise<Archive> {
    return this.run(`/actions/project/archive?/create`);
  }
}
