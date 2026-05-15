import eslintConfig from '@nanoforge-dev/utils-eslint-config';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import svelteConfig from './svelte.config.js';

export default [
  ...eslintConfig,
  { languageOptions: { globals: globals.browser } },
  ...svelte.configs.recommended,
  ...svelte.configs.prettier,
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: tseslint.parser,
        svelteConfig,
      },
    },
  },
  {
    rules: {
      'svelte/no-unused-svelte-ignore': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];
