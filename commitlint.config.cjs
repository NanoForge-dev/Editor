const { existsSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

/** Every workspace is a scope by its folder name: `apps/editor` → `editor`, `plugins/git` → `git`. */
const WORKSPACE_GROUPS = ['apps', 'packages', 'plugins', 'tooling'];
const WORKSPACES = WORKSPACE_GROUPS.flatMap((group) => {
  const dir = join(__dirname, group);
  return existsSync(dir)
    ? readdirSync(dir).filter((name) => existsSync(join(dir, name, 'package.json')))
    : [];
});

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      [...WORKSPACES, 'deps', 'ci', 'release', 'docs', 'tooling', 'specs'],
    ],
  },
};
