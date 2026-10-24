const PACKAGES = [
  'editor',
  'kernel',
  'sdk',
  'rpc',
  'history',
  'settings',
  'layout',
  'meta',
  'ui',
  'project',
  'code',
  'runtime',
  'server-core',
  'registry',
];

const { existsSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

/** Built-in plugins (`plugins/<name>`) are scopes too. */
const PLUGINS_DIR = join(__dirname, 'plugins');
const PLUGINS = existsSync(PLUGINS_DIR) ? readdirSync(PLUGINS_DIR) : [];

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      [...PACKAGES, ...PLUGINS, 'deps', 'ci', 'release', 'docs', 'tooling', 'specs'],
    ],
  },
};
