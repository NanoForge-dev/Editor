import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import extractorSvelte from '@unocss/extractor-svelte';
import { playwright } from '@vitest/browser-playwright';
import { builtinModules } from 'module';
import UnoCSS from 'unocss/vite';
import { defineConfig } from 'vitest/config';

const ssrNodeBuiltinsPlugin = {
  name: 'ssr-node-builtins',
  enforce: 'pre',
  resolveId(id: string, _importer: string | undefined, options: { ssr?: boolean }) {
    if (options?.ssr && builtinModules.includes(id) && !id.startsWith('bun')) {
      return { id: `node:${id}`, external: true };
    }
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    ssrNodeBuiltinsPlugin,
    UnoCSS({
      extractors: [extractorSvelte()],
    }),
    sveltekit(),
    paraglideVitePlugin({ project: './project.inlang', outdir: './src/lib/paraglide' }),
  ],
  test: {
    expect: { requireAssertions: true },
    projects: [
      {
        extends: './vite.config.ts',
        test: {
          name: 'client',
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium', headless: true }],
          },
          include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
          exclude: ['src/lib/server/**'],
        },
      },
      {
        extends: './vite.config.ts',
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/**/*.{test,spec}.{js,ts}'],
          exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
        },
      },
    ],
    coverage: {
      enabled: true,
      reporter: ['text', 'lcov', 'cobertura'],
      provider: 'v8',
      include: ['src/**/*.{ts,svelte}'],
      exclude: ['**/*.{interface,type,d}.ts', '**/{interfaces,types}/*.ts', '**/index.{js,ts}'],
    },
  },
});
