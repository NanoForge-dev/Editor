import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * Node tests (`*.spec.ts`) and real browser tests (`*.svelte.spec.ts`, Chromium through
 * Playwright). Set CHROME to use a locally installed browser instead of Playwright's.
 */
export default defineConfig({
  plugins: [svelte({ compilerOptions: { runes: true } })],
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['test/**/*.spec.ts'],
          exclude: ['**/*.svelte.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['test/**/*.svelte.spec.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              launchOptions: process.env.CHROME ? { executablePath: process.env.CHROME } : {},
            }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
