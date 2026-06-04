import { BaseRepository } from '../base.repository';
import type { InstallLibraryActionInput, InstallLibraryPackageResult } from '../types';

export class ProjectLibraryRepository extends BaseRepository {
  install(input: InstallLibraryActionInput): Promise<InstallLibraryPackageResult[]> {
    return this.run(`/actions/project/library?/install`, input);
  }
}
