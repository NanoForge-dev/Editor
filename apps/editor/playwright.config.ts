import { defineConfig } from '@playwright/test';
import { join } from 'node:path';

import { checkBuild } from './e2e/check-build';

const PORT = 4790;
const root = import.meta.dirname;
/** Folder of `e2e/` holding the test projects (`E2E_WORKSPACE`, see `e2e/workspace.ts`). */
const WORKSPACE = process.env.E2E_WORKSPACE || '.workspace';
if (!/^\.workspace(-[\w-]+)?$/.test(WORKSPACE))
  throw new Error(`E2E_WORKSPACE must be ".workspace" or ".workspace-<name>", not "${WORKSPACE}".`);

/**
 * End-to-end tests against the production build (`pnpm build` first). Each run starts from a
 * fresh workspace holding a copy of pong-network, with the example plugin as a dev plugin.
 * Set CHROME to use an installed Chromium instead of Playwright's, NANOFORGE_ENGINE to play the
 * pong-network example of another engine checkout (default: ../engine next to the editor).
 * Everything runs on Chromium; the browser cache spec also on Firefox, and on WebKit with
 * `BROWSERS=…,webkit` where it starts (it needs system libraries some distributions lack).
 */
const CROSS_BROWSER = 'cache.spec.ts';
const others = (process.env.BROWSERS ?? 'chromium,firefox')
  .split(',')
  .map((browser) => browser.trim())
  .filter(
    (browser): browser is 'firefox' | 'webkit' => browser === 'firefox' || browser === 'webkit',
  );

/**
 * Before the server starts, in the main process of `playwright test` only: workers load the
 * config too, and so do tools that read it (knip, editors).
 */
if (!process.env.TEST_WORKER_INDEX && process.argv.includes('test')) checkBuild();

export default defineConfig({
  testDir: 'e2e',
  testMatch: process.env.BENCH ? '*.bench.ts' : '*.spec.ts',
  testIgnore: '**/.workspace*/**',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1440, height: 860 },
    /** The theme follows the system by default: the tests run on the dark one. */
    colorScheme: 'dark',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: process.env.CHROME ? { executablePath: process.env.CHROME } : {},
      },
    },
    ...(process.env.BENCH
      ? []
      : others.map((browser) => ({
          name: browser,
          testMatch: CROSS_BROWSER,
          use: { browserName: browser },
        }))),
  ],
  webServer: {
    command: 'node e2e/prepare-workspace.mjs && bun ./dist/index.js',
    url: `http://127.0.0.1:${PORT}/healthz`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      FS_ROOT: join(root, 'e2e', WORKSPACE),
      DATA_DIR: join(root, 'e2e', WORKSPACE, '.data'),
      E2E_WORKSPACE: WORKSPACE,
      REGISTRY_DIR: join(root, 'e2e', WORKSPACE, '.registry'),
      DEV_PLUGINS: [
        join(root, '../../tooling/example-plugin'),
        join(root, '../../tooling/example-theme'),
        process.env.E2E_EXTRA_PLUGINS,
      ]
        .filter(Boolean)
        .join(','),
      ...(process.env.NANOFORGE_ENGINE && { NANOFORGE_ENGINE: process.env.NANOFORGE_ENGINE }),
      ...(process.env.NANOFORGE_CLI && { NANOFORGE_CLI: process.env.NANOFORGE_CLI }),
    },
  },
});
