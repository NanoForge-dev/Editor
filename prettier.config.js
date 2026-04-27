import prettierConfig from '@nanoforge-dev/utils-prettier-config';

export default {
  ...prettierConfig,
  plugins: ['@trivago/prettier-plugin-sort-imports', 'prettier-plugin-svelte'],
  overrides: [{ files: '*.svelte', options: { parser: 'svelte' } }],
  importOrder: [
    '^.app/(.*)$',
    '^.env/(.*)$',
    '^.lib/(.*)$',
    '^@utils/(.*)$',
    '^@utils-client/(.*)$',
    '^@utils-server/(.*)$',
    '^[./]',
  ],
  singleQuote: true,
};
