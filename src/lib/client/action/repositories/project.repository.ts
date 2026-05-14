import { BaseRepository } from '../base.repository';
import type { ActionProject, LoadProjectActionInput } from '../types';

export class ProjectRepository extends BaseRepository {
  load(input: LoadProjectActionInput): Promise<ActionProject> {
    return this.run(`/actions/project?/load`, input);
  }
}
