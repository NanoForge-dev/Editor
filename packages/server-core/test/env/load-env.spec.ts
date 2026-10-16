import { describe, expect, it } from 'vitest';

import { loadEnv } from '../../src/env/load-env';

describe('loadEnv', () => {
  it('listens on loopback by default in a local editor', () => {
    expect(loadEnv({ NODE_ENV: 'test' }).host).toBe('127.0.0.1');
    for (const host of ['localhost', '127.0.0.1', '127.1.2.3', '::1'])
      expect(loadEnv({ NODE_ENV: 'test', HOST: host }).host).toBe(host);
  });

  it('refuses a local editor on another address unless told it is protected', () => {
    expect(() => loadEnv({ NODE_ENV: 'test', HOST: '0.0.0.0' })).toThrow(
      /HOST: a local \(OFFLINE\)/,
    );
    expect(() => loadEnv({ NODE_ENV: 'test', HOST: '192.168.1.20' })).toThrow(/HOST/);
    expect(loadEnv({ NODE_ENV: 'test', HOST: '0.0.0.0', ALLOW_REMOTE_OFFLINE: '1' }).host).toBe(
      '0.0.0.0',
    );
    expect(
      loadEnv({ NODE_ENV: 'test', PUBLIC_MODE: 'ONLINE', API_KEY: 'k', HOST: '0.0.0.0' }).host,
    ).toBe('0.0.0.0');
  });
});
