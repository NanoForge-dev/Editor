import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import eslintConfig from '@nanoforge-dev/utils-eslint-config';

/**
 * Import boundaries (see docs/rewrite-plan.md):
 * - kernel depends on no other editor package;
 * - core packages never import plugins;
 * - plugins only talk to the editor through the public sdk.
 */
const INTERNAL_PACKAGES = [
  'kernel',
  'rpc',
  'history',
  'settings',
  'layout',
  'ui',
  'project',
  'code',
  'runtime',
  'server-core',
].map((name) => `@nanoforge-dev/editor-${name}`);

const restrict = (patterns, message) => ({
  'no-restricted-imports': ['error', { patterns: [{ group: patterns, message }] }],
});

export default [
  { ignores: ['**/dist/**', '**/.svelte-kit/**', '**/coverage/**', '**/build/**'] },
  ...eslintConfig,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  ...svelte.configs.recommended,
  ...svelte.configs.prettier,
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: tseslint.parser,
      },
    },
  },
  {
    rules: {
      'svelte/no-unused-svelte-ignore': 'off',
      'svelte/no-navigation-without-resolve': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['packages/kernel/**'],
    rules: restrict(
      ['@nanoforge-dev/editor-*'],
      'The kernel must not depend on other editor packages.',
    ),
  },
  {
    files: ['packages/registry/**'],
    rules: restrict(
      ['@nanoforge-dev/editor-*'],
      'The registry package must stay free of editor code: it is meant to move to the CLI.',
    ),
  },
  {
    files: ['packages/**'],
    ignores: ['packages/kernel/**', 'packages/registry/**'],
    rules: restrict(
      ['@nanoforge-dev/editor-plugin-*'],
      'Core packages must not depend on plugins.',
    ),
  },
  {
    files: ['plugins/**'],
    rules: restrict(
      [...INTERNAL_PACKAGES, '@nanoforge-dev/editor-plugin-*'],
      'Plugins may only import @nanoforge-dev/editor-sdk (declare other plugins as dependencies instead).',
    ),
  },
];
