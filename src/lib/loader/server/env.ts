import { env } from '$env/dynamic/private';

const PREFIX = 'NANOFORGE_';

export const getGameEnv = () => {
  return Object.fromEntries(
    Object.entries(env)
      .filter(([key]) => key.startsWith(PREFIX))
      .map(([key, value]) => [key.replace(PREFIX, ''), value]),
  );
};
