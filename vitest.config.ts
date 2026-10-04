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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src'],
      exclude: ['**/*.{type,d}.ts', '**/index.ts'],
    },
  },
});
