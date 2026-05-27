import { BaseRepository } from '../base.repository';
import type { GetSaveResult, SetSaveInput } from '../types';

export class ProjectSaveRepository extends BaseRepository {
  get(): Promise<GetSaveResult> {
    return this.run(`/actions/project/save?/get`);
  }
  set(input: SetSaveInput): Promise<object> {
    return this.run(`/actions/project/save?/set`, input);
  }
}
