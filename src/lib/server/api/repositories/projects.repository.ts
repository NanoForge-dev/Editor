import { BaseRepository } from '../base.repository';
import type { ApiProject } from '../types';

export class ProjectRepository extends BaseRepository {
  getProject(id: string): Promise<ApiProject> {
    return this.get(`/editor/projects/${id}`);
  }

  getProjects(): Promise<ApiProject[]> {
    return this.get(`/projects`);
  }
}
