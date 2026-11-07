import { defineConfig, devices } from '@playwright/test';
import baseConfig from './playwright.config';

const launchArgs = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

export default defineConfig({
  ...baseConfig,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: launchArgs,
          ...(process.env.PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH
            ? { executablePath: process.env.PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH }
            : {}),
        },
      },
    },
  ],
  webServer: { command: 'pnpm run build && pnpm run preview', port: 4173 },
});
