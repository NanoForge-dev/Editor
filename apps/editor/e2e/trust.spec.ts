import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from './test';
import { PONG, WORKSPACE } from './workspace';

/** A copy of pong never trusted before, with a plugin of its own. */
const FOLDER = join(WORKSPACE, 'restricted');

test.beforeAll(() => {
  rmSync(FOLDER, { recursive: true, force: true });
  cpSync(PONG, FOLDER, {
    recursive: true,
    filter: (source) => !source.includes(`${PONG}/.nanoforge`),
  });
  const plugin = join(FOLDER, '.nanoforge/plugins/@acme/restricted');
  mkdirSync(plugin, { recursive: true });
  writeFileSync(
    join(plugin, 'nanoforge.manifest.json'),
    JSON.stringify({
      type: 'plugin',
      name: '@acme/restricted',
      version: '1.0.0',
      engines: { editor: '*' },
      entry: { client: 'index.js' },
    }),
  );
  writeFileSync(join(plugin, 'index.js'), 'export const activate = () => {};\n');
});

test.afterAll(() => rmSync(FOLDER, { recursive: true, force: true }));

test('opens a folder in restricted mode until it is trusted', async ({ page }) => {
  await page.goto('/load?path=restricted');
  await page.getByRole('button', { name: 'Open in restricted mode', exact: true }).click();
  await page.waitForURL(/\/project\//);
  const restricted = page.getByText(/^Restricted mode: .* code does not run$/);
  await expect(restricted).toBeVisible();

  await page
    .getByRole('toolbar', { name: 'Run' })
    .getByRole('button', { name: 'Play', exact: false })
    .click();
  await expect(page.getByText('Trust this folder to play its games')).toBeVisible();

  const settings = async () => {
    await page.locator('[data-nf-part="screen"]').click();
    await page.keyboard.press('Control+Alt+s');
    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await dialog.getByRole('treeitem', { name: 'Plugins' }).click();
    return dialog.getByRole('region', { name: 'Plugins' });
  };
  await expect(
    (await settings()).getByText('@acme/restricted · 1.0.0 · installed for this project', {
      exact: false,
    }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Trust this folder' }).first().click();
  await page.waitForURL(/\/project\//);
  await expect(page.getByRole('tab', { name: 'Files' })).toBeVisible();
  await expect(restricted).toHaveCount(0);
  await expect(
    (await settings()).getByText('@acme/restricted · 1.0.0 · installed for this project', {
      exact: false,
    }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
});
