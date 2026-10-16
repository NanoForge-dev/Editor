import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import eslintConfig from '@nanoforge-dev/utils-eslint-config';

/**
 * Import boundaries (see docs/rewrite-plan.md):
 * - kernel depends on no other editor package;
 * - core packages never import plugins;
 * - plugin sources only talk to the editor through the public sdk;
 * - the compiler (ts-morph, TypeScript) stays in the code worker.
 */
const restrict = (patterns, message) => ({
  'no-restricted-imports': ['error', { patterns: [{ group: patterns, message }] }],
});

/** Tool directives allowed as `//` or `<!-- -->` comments (CLAUDE.md, "Comments"). */
const DIRECTIVES =
  /^\s*(eslint-|@ts-|prettier-ignore|svelte-ignore|global |#region|#endregion|\/ <reference )/;

/** House rules that no published ESLint rule covers. */
const nanoforge = {
  rules: {
    'no-line-comments': {
      meta: {
        type: 'suggestion',
        messages: {
          comment:
            'Use a /** */ doc comment, or no comment: `//` and `<!-- -->` are for tool directives only.',
        },
        schema: [],
      },
      create(context) {
        const report = (node, text, loc) => {
          if (!DIRECTIVES.test(text)) context.report({ loc, messageId: 'comment' });
        };
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments()) {
              if (comment.type === 'Line') report(comment, comment.value, comment.loc);
            }
          },
          SvelteHTMLComment(node) {
            report(node, node.value, node.loc);
          },
        };
      },
    },
  },
};

export default [
  {
    ignores: [
      '**/dist/**',
      '**/.svelte-kit/**',
      '**/coverage/**',
      '**/build/**',
      '**/test/fixtures/**',
      '**/test/.tmp-*/**',
      '**/__screenshots__/**',
      'apps/editor/e2e/.workspace*/**',
      'apps/editor/test-results/**',
      'apps/editor/playwright-report/**',
      'examples/**',
      'docs/drafts/**',
    ],
  },
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
    files: ['**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    plugins: { nanoforge },
    rules: { 'nanoforge/no-line-comments': 'error' },
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
    files: ['plugins/*/src/**'],
    rules: restrict(
      ['@nanoforge-dev/*', '!@nanoforge-dev/editor-sdk', '!@nanoforge-dev/editor-sdk/*'],
      'Plugins may only import @nanoforge-dev/editor-sdk (declare other plugins as dependencies instead).',
    ),
  },
  {
    files: ['apps/editor/src/**', 'packages/*/src/**', 'plugins/*/src/**'],
    ignores: [
      'packages/code/src/worker.ts',
      'packages/code/src/engine/**',
      'packages/meta/**',
      'packages/sdk/src/worker.ts',
      'plugins/*/src/worker/**',
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: ['@nanoforge-dev/editor-code/engine', '@nanoforge-dev/editor-meta'].map(
            (name) => ({
              name,
              allowTypeImports: true,
              message:
                'The compiler stays in the code worker: import types only here, or use @nanoforge-dev/editor-meta/pure.',
            }),
          ),
        },
      ],
    },
  },
];
