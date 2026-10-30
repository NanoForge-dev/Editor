import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

/**
 * Node tests (`*.spec.ts`) and real browser tests of the caches (`*.browser.spec.ts`: OPFS,
 * IndexedDB, Web Locks) on Chromium and Firefox. WebKit needs system libraries some Linux
 * distributions lack: `BROWSERS=chromium,firefox,webkit` adds it where it runs.
 */
export default defineConfig({
  test: {
    passWithNoTests: true,
    setupFiles: [root('vitest.setup.ts')],
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['test/**/*.spec.ts'],
          exclude: ['**/*.browser.spec.ts'],
          globalSetup: [root('vitest.global-setup.ts')],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['test/**/*.browser.spec.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: (process.env.BROWSERS ?? 'chromium,firefox').split(',').map((browser) => ({
              browser: browser.trim() as 'chromium' | 'firefox' | 'webkit',
            })),
          },
        },
      },
    ],
  },
});
