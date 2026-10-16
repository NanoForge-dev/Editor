import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { openProject, resetLayout } from './helpers';
import { expect, test } from './test';
import { PONG } from './workspace';

const PROJECT_PLUGINS = join(PONG, '.nanoforge/plugins');
const PACKAGES = join(PONG, 'nf_modules');
/** Written by the project plugin's server entry: `on` while it runs, `off` once stopped. */
const SERVER_STATE = join(PONG, '..', 'local-plugin-server.txt');
const serverState = () => (existsSync(SERVER_STATE) ? readFileSync(SERVER_STATE, 'utf8') : '');

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
    entry: { client: 'index.js', server: 'server.js' },
    contributes: {
      commands: [{ id: 'acme.local.ping', title: 'Ping from the project plugin' }],
    },
  });
  write(
    join(PROJECT_PLUGINS, '@acme/local/index.js'),
    "export const activate = (ctx) => { ctx.registerCommand('acme.local.ping', () => undefined); };\n",
  );
  write(
    join(PROJECT_PLUGINS, '@acme/local/server.js'),
    `import { writeFileSync } from 'node:fs';
const state = ${JSON.stringify(SERVER_STATE)};
export const activate = () => writeFileSync(state, 'on');
export const deactivate = () => writeFileSync(state, 'off');
`,
  );
  write(join(PACKAGES, '@acme/motion/nanoforge.manifest.json'), {
    type: 'package',
    name: '@acme/motion',
    version: '1.0.0',
    suggestedPlugins: ['@acme/local', '@acme/gizmos'],
  });
});

test.afterEach(() => {
  rmSync(SERVER_STATE, { force: true });
  rmSync(PROJECT_PLUGINS, { recursive: true, force: true });
  rmSync(PACKAGES, { recursive: true, force: true });
});

test("loads the project's plugins and names the plugins its packages suggest", async ({ page }) => {
  await openProject(page, 'pong');
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

test("runs a project plugin's server entry while the project is open", async ({ page }) => {
  const closeProject = async () => {
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Close project' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/project/'));
  };
  await openProject(page, 'pong');
  await page.waitForURL(/\/project\//);
  await closeProject();
  await expect.poll(serverState).toBe('off');

  await openProject(page, 'pong');
  await page.waitForURL(/\/project\//);
  await expect.poll(serverState).toBe('on');

  const toggle = async (name: string) => {
    await page.locator('[data-nf-part="screen"]').click();
    await page.keyboard.press('Control+Alt+s');
    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await dialog.getByRole('treeitem', { name: 'Plugins' }).click();
    const plugins = dialog.getByRole('region', { name: 'Plugins' });
    await plugins.getByRole('switch', { name }).click();
    await plugins.getByRole('button', { name: 'Apply and reload' }).click();
    await page.waitForURL(/\/project\//);
  };
  await toggle('Disable Local tools');
  await expect.poll(serverState).toBe('off');
  await toggle('Enable Local tools');
  await expect.poll(serverState).toBe('on');
  await page.locator('[data-nf-part="screen"]').click();
  await page.keyboard.press('Control+Alt+s');
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings.getByRole('status')).toHaveText('Account synced');
  await page.keyboard.press('Escape');

  await closeProject();
  await expect.poll(serverState).toBe('off');
});
