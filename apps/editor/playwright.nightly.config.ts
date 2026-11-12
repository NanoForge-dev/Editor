import { defineConfig } from '@playwright/test';

import baseConfig from './playwright.config';

/**
 * The nightly run (`scripts/nightly.sh`, in the cloud-iac nightly image): Chromium only, the
 * system one from `PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH`, with the flags a container needs.
 */
const executablePath = process.env.PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH ?? process.env.CHROME;

export default defineConfig({
  ...baseConfig,
  retries: 1,
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ],
          ...(executablePath ? { executablePath } : {}),
        },
      },
    },
  ],
});
