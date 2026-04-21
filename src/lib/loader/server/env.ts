import { env } from '$env/dynamic/private';

const PREFIX_CLIENT = 'NANOFORGE_CLIENT_';
const PREFIX_SERVER = 'NANOFORGE_SERVER_';
const PREFIX = 'NANOFORGE_';

export const getGameEnv = (side: 'client' | 'server') => {
  return Object.fromEntries(
    Object.entries(env)
      .filter(
        ([key]) =>
          key.startsWith(PREFIX) ||
          key.startsWith(side === 'client' ? PREFIX_CLIENT : PREFIX_SERVER),
      )
      .map(([key, value]) => [key.replace(PREFIX, ''), value]),
  );
};
