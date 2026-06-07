import { PUBLIC_MODE } from '$env/static/public';

import type { Config } from './config.type';

export const getConfig = (): Config => {
  return {
    mode: PUBLIC_MODE === 'ONLINE' ? 'online' : 'offline',
  };
};
