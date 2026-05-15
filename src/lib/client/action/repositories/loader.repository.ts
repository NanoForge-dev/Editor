import { BaseRepository } from '../base.repository';
import type { ActionLoaderEnv, ActionLoaderManifest } from '../types';

export class ProjectLoaderRepository extends BaseRepository {
  env(): Promise<ActionLoaderEnv> {
    return this.run(`/actions/project/loader?/env`);
  }

  manifest(): Promise<ActionLoaderManifest> {
    return this.run(`/actions/project/loader?/manifest`);
  }
}
