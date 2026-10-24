import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Shared unit-test config. Each package runs `vitest run --config ../../vitest.config.ts`
 * from its own directory, so `include` is relative to the package.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    exclude: ['**/node_modules', '**/dist', '**/*.svelte.spec.ts'],
    passWithNoTests: true,
    /** Tests that build a ts-morph project or a TypeScript program take seconds on CI runners. */
    testTimeout: 30_000,
    globalSetup: [fileURLToPath(new URL('./vitest.global-setup.ts', import.meta.url))],
    setupFiles: [fileURLToPath(new URL('./vitest.setup.ts', import.meta.url))],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src'],
      exclude: ['**/*.{type,d}.ts', '**/index.ts'],
    },
  },
});
