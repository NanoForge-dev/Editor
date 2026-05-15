import { HttpClient } from '@utils/http';

import { ConfigRepository } from './repositories/config.repository';
import { ProjectLoaderRepository } from './repositories/loader.repository';
import { ProjectRepository } from './repositories/project.repository';

export interface ActionClient {
  config: ConfigRepository;
  loader: ProjectLoaderRepository;
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
    loader: new ProjectLoaderRepository(client),
    project: new ProjectRepository(client),
  };
};
