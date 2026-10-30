import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { loadEnv } from '../../src/env/load-env';
import { createEditorServer } from '../../src/server/create-editor-server';
import { linkWithToken } from '../../src/server/launch-token';
import { TEST_ORIGIN as ORIGIN } from '../../src/testing';

const folders: string[] = [];
const server = (EDITOR_TOKEN: string | undefined, PUBLIC_MODE = 'OFFLINE') => {
  const workspace = mkdtempSync(join(tmpdir(), 'nf-token-'));
  folders.push(workspace);
  const staticDir = join(workspace, 'static');
  mkdirSync(staticDir, { recursive: true });
  writeFileSync(join(staticDir, 'index.html'), '<html>editor</html>');
  const env = loadEnv(
    {
      NODE_ENV: 'test',
      PUBLIC_MODE,
      ...(PUBLIC_MODE === 'ONLINE' && { API_KEY: 'key' }),
      FS_ROOT: workspace,
      DATA_DIR: join(workspace, 'data'),
      ...(EDITOR_TOKEN && { EDITOR_TOKEN }),
    },
    workspace,
  );
  return { env, editor: createEditorServer({ env, version: '0.0.0-test', staticDir }) };
};

afterAll(() => {
  for (const folder of folders) rmSync(folder, { recursive: true, force: true });
});

describe('launch token', () => {
  it('answers only a browser that opened the link with the token', async () => {
    const { editor } = server('a-long-enough-token');
    const page = (path: string, headers: Record<string, string> = {}) =>
      editor.fetch(
        new Request(`${ORIGIN}${path}`, { headers: { accept: 'text/html', ...headers } }),
      );

    const refused = (await page('/project/abc'))!;
    expect(refused.status).toBe(401);
    expect(await refused.text()).toContain('?token=');
    expect((await page('/project/abc?token=wrong'))!.status).toBe(401);
    expect(
      (await editor.fetch(
        new Request(`${ORIGIN}/rpc/session.info`, { method: 'POST', body: 'null' }),
      ))!.status,
    ).toBe(401);

    const link = (await page('/project/abc?token=a-long-enough-token&tour=x'))!;
    expect(link.status).toBe(303);
    expect(link.headers.get('location')).toBe('/project/abc?tour=x');
    const cookie = link.headers.get('set-cookie')!;
    expect(cookie).toMatch(
      /^nf_editor_token=a-long-enough-token; Path=\/; HttpOnly; SameSite=Strict/,
    );

    const opened = (await page('/project/abc', { cookie: cookie.split(';')[0]! }))!;
    expect(opened.status).toBe(200);
    expect((await page('/healthz'))!.status).toBe(200);
    editor.dispose();
  });

  it('asks none without EDITOR_TOKEN, a new one with random, and none in a hosted editor', () => {
    const none = server(undefined);
    expect(none.env.launchToken).toBeUndefined();
    const random = server('random');
    expect(random.env.launchToken).toMatch(/^[\w-]{32}$/);
    expect(linkWithToken('http://127.0.0.1:3000/', random.env.launchToken!)).toBe(
      `http://127.0.0.1:3000/?token=${random.env.launchToken}`,
    );
    expect(server('a-long-enough-token', 'ONLINE').env.launchToken).toBeUndefined();
    for (const { editor } of [none, random]) editor.dispose();
  });
});
