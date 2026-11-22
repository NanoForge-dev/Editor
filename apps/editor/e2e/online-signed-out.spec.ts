import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from './test';

/** A hosted (ONLINE) editor of its own, next to the suite's local one (4790). */
const PORT = 4791;
const URL = `http://127.0.0.1:${PORT}`;
/** Where the sign-in button leads. Nothing listens there: the test never calls a real API. */
const LOGIN = 'http://127.0.0.1:9/login';

let server: ChildProcess | undefined;
let folder: string;

test.beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), 'nf-online-e2e-'));
  server = spawn('bun', ['./dist/index.js'], {
    cwd: join(import.meta.dirname, '..'),
    stdio: 'ignore',
    env: {
      ...process.env,
      PUBLIC_MODE: 'ONLINE',
      PORT: String(PORT),
      HOST: '127.0.0.1',
      FS_ROOT: folder,
      DATA_DIR: join(folder, '.data'),
      API_URL: 'http://127.0.0.1:9',
      API_KEY: 'e2e',
      PUBLIC_PM_URL: LOGIN,
    },
  });
  await expect
    .poll(
      () =>
        fetch(`${URL}/healthz`).then(
          (response) => response.ok,
          () => false,
        ),
      {
        timeout: 30_000,
      },
    )
    .toBe(true);
});

test.afterAll(() => {
  server?.kill();
  rmSync(folder, { recursive: true, force: true });
});

test('a hosted editor asks a signed-out visitor to sign in', async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByRole('heading', { name: 'Sign in to open your projects' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('button', { name: 'Sign in on NanoForge' })).toBeVisible();
  await expect(page.getByText('The editor failed to start')).toHaveCount(0);
});
