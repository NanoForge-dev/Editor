import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { resetLayout } from './helpers';
import { expect, test } from './test';
import { PONG } from './workspace';

const PROJECT_PLUGINS = join(PONG, '.nanoforge/plugins');
const PACKAGES = join(PONG, 'nf_modules');

const write = (path: string, content: unknown) => {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
};

test.beforeEach(() => {
  write(join(PROJECT_PLUGINS, '@acme/local/nanoforge.manifest.json'), {
    type: 'plugin',
    name: '@acme/local',
    version: '1.0.0',
    displayName: 'Local tools',
    engines: { editor: '*' },
    entry: { client: 'index.js' },
    contributes: {
      commands: [{ id: 'acme.local.ping', title: 'Ping from the project plugin' }],
    },
  });
  write(
    join(PROJECT_PLUGINS, '@acme/local/index.js'),
    "export const activate = (ctx) => { ctx.registerCommand('acme.local.ping', () => undefined); };\n",
  );
  write(join(PACKAGES, '@acme/motion/nanoforge.manifest.json'), {
    type: 'package',
    name: '@acme/motion',
    version: '1.0.0',
    suggestedPlugins: ['@acme/local', '@acme/gizmos'],
  });
});

test.afterEach(() => {
  rmSync(PROJECT_PLUGINS, { recursive: true, force: true });
  rmSync(PACKAGES, { recursive: true, force: true });
});

test("loads the project's plugins and names the plugins its packages suggest", async ({ page }) => {
  await page.goto('/load?path=pong');
  await page.waitForURL(/\/project\//);
  await resetLayout(page);

  await expect(page.getByText('Packages in this project suggest a plugin')).toBeVisible();
  await expect(page.getByText('@acme/gizmos (for @acme/motion)', { exact: false })).toBeVisible();

  await page.locator('[data-nf-part="screen"]').click();
  await page.keyboard.press('Control+Alt+s');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('treeitem', { name: 'Plugins' }).click();
  const plugins = dialog.getByRole('region', { name: 'Plugins' });
  await expect(
    plugins.getByText('@acme/local · 1.0.0 · installed for this project', { exact: false }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
});
