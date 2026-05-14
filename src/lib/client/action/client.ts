import { HttpClient } from '@utils/http';

import { ConfigRepository } from './repositories/config.repository';
import { ProjectRepository } from './repositories/project.repository';

export interface ActionClient {
  config: ConfigRepository;
  project: ProjectRepository;
}

export const getActionClient = (): ActionClient => {
  const client = new HttpClient('', {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return {
    config: new ConfigRepository(client),
    project: new ProjectRepository(client),
  };
};
