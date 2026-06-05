import { BaseRepository } from '../base.repository';
import type {
  ActionProject,
  CompleteProjectActionInput,
  CreateProjectActionInput,
  GatewayProjectResult,
  InfoProjectInput,
  InfoProjectResult,
  LoadProjectActionInput,
} from '../types';

export class ProjectRepository extends BaseRepository {
  load(input: LoadProjectActionInput): Promise<ActionProject> {
    return this.run(`/actions/project?/load`, input);
  }

  new(input: CreateProjectActionInput): Promise<ActionProject> {
    return this.run(`/actions/project?/new`, input);
  }

  complete(input: CompleteProjectActionInput): Promise<ActionProject> {
    return this.run(`/actions/project?/complete`, input);
  }

  getInfo(): Promise<InfoProjectResult> {
    return this.run(`/actions/project?/get-info`);
  }

  setInfo(input: InfoProjectInput): Promise<object> {
    return this.run(`/actions/project?/set-info`, input);
  }

  getGatewayProjects(): Promise<GatewayProjectResult[]> {
    return this.run(`/actions/project?/get-gateway-projects`);
  }
}
