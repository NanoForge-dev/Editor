import { BaseRepository } from '../base.repository';
import type { ApiProject } from '../types';

export class ProjectRepository extends BaseRepository {
  getProject(id: string): Promise<ApiProject> {
    this.assertOnline();
    return this.get(`/editor/projects/${id}`);
  }

  getProjects(): Promise<ApiProject[]> {
    this.assertOnline();
    return this.get(`/projects}`);
  }
}
