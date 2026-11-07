import { describe, expect, it } from 'vitest';

import { childEnv } from '../../src/process/child-env';

describe('childEnv', () => {
  it('keeps what tools need and drops the server settings', () => {
    const env = childEnv(
      { FORCE_COLOR: '0', HOME: undefined },
      {
        PATH: '/usr/bin',
        HOME: '/home/ada',
        LC_ALL: 'C',
        NANOFORGE_LEVEL: '2',
        SESSION_SECRET: 's',
        API_KEY: 'k',
        PORT: '3000',
        GIT_DIR: '/elsewhere',
      },
    );
    expect(env).toEqual({ PATH: '/usr/bin', LC_ALL: 'C', NANOFORGE_LEVEL: '2', FORCE_COLOR: '0' });
  });
});
