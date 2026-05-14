import { env } from '$env/dynamic/public';

import type { Config } from './config.type';

export const getConfig = (): Config => {
  return {
    mode: env.PUBLIC_MODE === 'offline' ? 'offline' : 'online',
  };
};
