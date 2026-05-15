import { BaseRepository } from '../base.repository';
import type {
  ActionProject,
  AddComponentActionInput,
  AddRegistryComponentActionResult,
  AddSystemActionInput,
  CreateProjectActionInput,
  LoadProjectActionInput,
} from '../types';

export class ProjectRepository extends BaseRepository {
  load(input: LoadProjectActionInput): Promise<ActionProject> {
    return this.run(`/actions/project?/load`, input);
  }
  new(input: CreateProjectActionInput): Promise<ActionProject> {
    return this.run(`/actions/project?/new`, input);
  }
  generate(): Promise<object> {
    return this.run(`/actions/project?/generate`);
  }
  build(): Promise<object> {
    return this.run(`/actions/project?/build`);
  }
  addComponent(input: AddComponentActionInput): Promise<AddRegistryComponentActionResult> {
    return this.run(`/actions/project?/addComponent`, input);
  }
  addSystem(input: AddSystemActionInput): Promise<AddRegistryComponentActionResult> {
    return this.run(`/actions/project?/addSystem`, input);
  }
}
