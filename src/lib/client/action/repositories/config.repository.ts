import { BaseRepository } from '../base.repository';
import type { ActionConfig } from '../types';

export class ConfigRepository extends BaseRepository {
  fetch(): Promise<ActionConfig> {
    return this.run(`/actions/config?/fetch`);
  }
}
