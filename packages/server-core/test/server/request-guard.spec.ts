import { describe, expect, it } from 'vitest';

import { loadEnv } from '../../src/env/load-env';
import { hostAllowed, originAllowed } from '../../src/server/request-guard';

const offline = loadEnv({ NODE_ENV: 'test', ALLOWED_HOSTS: 'editor.lan' });
const online = (hosts = '') =>
  loadEnv({ NODE_ENV: 'test', PUBLIC_MODE: 'ONLINE', API_KEY: 'k', ALLOWED_HOSTS: hosts });

describe('hostAllowed', () => {
  it('answers a local editor only by loopback names and ALLOWED_HOSTS', () => {
    for (const host of ['localhost:3000', '127.0.0.1:4790', '[::1]:3000', 'editor.localhost'])
      expect(hostAllowed(offline, host)).toBe(true);
    expect(hostAllowed(offline, 'editor.lan:3000')).toBe(true);
    expect(hostAllowed(offline, 'evil.example:3000')).toBe(false);
    expect(hostAllowed(offline, null)).toBe(false);
  });

  it('checks a hosted editor when ALLOWED_HOSTS is set', () => {
    expect(hostAllowed(online(), 'editor.nanoforge.eu')).toBe(true);
    expect(hostAllowed(online('editor.nanoforge.eu'), 'editor.nanoforge.eu')).toBe(true);
    expect(hostAllowed(online('editor.nanoforge.eu'), 'evil.example')).toBe(false);
  });
});

describe('originAllowed', () => {
  const request = (headers: Record<string, string>) =>
    new Request('http://localhost:3000/files/p/a.png', { headers });

  it('lets same-origin requests, navigations and non-browser clients through', () => {
    expect(
      originAllowed(offline, request({ origin: 'http://localhost:3000', host: 'localhost:3000' })),
    ).toBe(true);
    expect(originAllowed(offline, request({}))).toBe(true);
    expect(
      originAllowed(
        offline,
        request({ 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' }),
      ),
    ).toBe(true);
  });

  it('refuses other origins and cross-site loads', () => {
    expect(originAllowed(offline, request({ origin: 'https://evil.example' }))).toBe(false);
    expect(originAllowed(offline, request({ origin: 'null' }))).toBe(false);
    expect(
      originAllowed(
        offline,
        request({ 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'no-cors' }),
      ),
    ).toBe(false);
  });
});
