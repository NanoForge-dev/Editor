import {
  type ActionProject,
  type CreateProjectActionInput,
  getActionClient,
} from '$lib/client/action';
import { type Project } from '$lib/client/project';

export class ProjectLoader {
  static async create(input: CreateProjectActionInput) {
    const res = await getActionClient().project.new(input);

    return ProjectLoader.load(res);
  }

  static load(project: ActionProject): Project {
    void project;
    throw new Error('Not implemented yet');
  }
}
