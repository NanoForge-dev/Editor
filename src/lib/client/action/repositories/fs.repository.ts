import { BaseRepository } from '../base.repository';
import type { ReaddirFsActionInput, ReaddirFsActionResult } from '../types';

export class ProjectFsRepository extends BaseRepository {
  readdir(input: ReaddirFsActionInput): Promise<ReaddirFsActionResult> {
    return this.run(`/actions/project/fs?/readdir`, input);
  }
}
