import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { type Page, expect, test } from './test';
import { PONG } from './workspace';

const PROJECT_SETTINGS = join(PONG, '.nanoforge/editor/settings.json');
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Settings' });
const search = (page: Page) => dialog(page).getByRole('textbox', { name: 'Search settings' });
const setting = (page: Page, key: string) => dialog(page).locator(`[data-key="${key}"]`);
const projectValue = (key: string): unknown =>
  existsSync(PROJECT_SETTINGS)
    ? (JSON.parse(readFileSync(PROJECT_SETTINGS, 'utf8')) as Record<string, unknown>)[key]
    : undefined;

const MAXIMIZE = '@nanoforge/viewport.maximizeOnPlay';

const open = async (page: Page) => {
  await page.goto('/load?path=pong');
  await page.waitForURL(/\/project\//);
  await expect(page.getByRole('tab', { name: 'Files' })).toBeVisible();
};

const openSettings = async (page: Page) => {
  await page.locator('[data-nf-part="screen"]').click();
  await page.keyboard.press('Control+Alt+s');
  await expect(dialog(page)).toBeVisible();
};

test('finds a setting, applies or cancels a change', async ({ page }) => {
  await open(page);
  await openSettings(page);
  await search(page).fill('maximize play');
  await expect(dialog(page).locator('[data-key]')).toHaveCount(1);
  const toggle = setting(page, MAXIMIZE).getByRole('switch', { name: 'Maximize on play' });
  await setting(page, MAXIMIZE).getByRole('button', { name: 'Scope of Maximize on play' }).click();
  await page.getByRole('menuitem', { name: 'This machine' }).click();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await openSettings(page);
  await search(page).fill('maximize play');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  await setting(page, MAXIMIZE).getByRole('button', { name: 'Scope of Maximize on play' }).click();
  await page.getByRole('menuitem', { name: 'This machine' }).click();
  await toggle.click();
  await dialog(page).getByRole('button', { name: 'Apply' }).click();
  await expect(dialog(page).getByRole('button', { name: 'Apply' })).toBeDisabled();
  await dialog(page).getByRole('button', { name: 'OK' }).click();
  await openSettings(page);
  await search(page).fill('maximize play');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(
    setting(page, MAXIMIZE).getByRole('button', { name: 'Scope of Maximize on play' }),
  ).toHaveText('This machine');
});

test('writes a setting to another scope, inspects and resets it', async ({ page }) => {
  await open(page);
  await openSettings(page);
  await dialog(page).getByRole('treeitem', { name: 'Game view' }).click();
  const row = setting(page, MAXIMIZE);
  await row.getByRole('button', { name: 'Scope of Maximize on play' }).click();
  await page.getByRole('menuitem', { name: 'Project', exact: true }).click();
  await row.getByRole('switch', { name: 'Maximize on play' }).click();
  await dialog(page).getByRole('button', { name: 'Apply' }).click();
  await expect.poll(() => projectValue(MAXIMIZE)).toBe(true);

  await row.getByRole('button', { name: 'Values of Maximize on play in each scope' }).click();
  const values = row.getByRole('table', { name: 'Values of Maximize on play' });
  await expect(values.getByRole('row', { name: /^Project true/ })).toBeVisible();
  await expect(values.getByRole('row', { name: /^Default false/ })).toBeVisible();

  await values
    .getByRole('row', { name: /^Project true/ })
    .getByRole('button', { name: 'Reset' })
    .click();
  await dialog(page).getByRole('button', { name: 'OK' }).click();
  await expect.poll(() => projectValue(MAXIMIZE)).toBeUndefined();
});

test('disables a plugin', async ({ page }) => {
  await open(page);
  await openSettings(page);
  await dialog(page).getByRole('treeitem', { name: 'Plugins' }).click();
  const plugins = dialog(page).getByRole('region', { name: 'Plugins' });
  await expect(plugins.getByText('@acme/hello', { exact: false })).toBeVisible();
  await plugins.getByRole('switch', { name: 'Disable Hello' }).click();
  await plugins.getByRole('button', { name: 'Apply and reload' }).click();
  await expect(page.getByRole('tab', { name: 'Files' })).toBeVisible();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Say hello twice' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await openSettings(page);
  await dialog(page).getByRole('treeitem', { name: 'Plugins' }).click();
  await plugins.getByRole('switch', { name: 'Enable Hello' }).click();
  await plugins.getByRole('button', { name: 'Apply and reload' }).click();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Say hello twice' })).toBeVisible();
  await page.keyboard.press('Escape');
  await openSettings(page);
  await expect(dialog(page).getByRole('status')).toHaveText('Account synced');
});

test('exports and imports settings with a preview', async ({ page }, testInfo) => {
  await open(page);
  await openSettings(page);
  await dialog(page).getByRole('treeitem', { name: 'Import & export' }).click();

  const download = page.waitForEvent('download');
  await dialog(page).getByRole('button', { name: 'Export…' }).click();
  expect((await download).suggestedFilename()).toBe('nanoforge-settings-machine.json');

  const file = testInfo.outputPath('settings.json');
  writeFileSync(
    file,
    JSON.stringify({ 'history.limit': 42, 'acme.unknown': 1, 'history.mergeWindowMs': -3 }),
  );
  const chooser = page.waitForEvent('filechooser');
  await dialog(page).getByRole('button', { name: 'Import…' }).click();
  await (await chooser).setFiles(file);
  const preview = dialog(page).getByRole('region', { name: 'Import preview' });
  await expect(preview).toContainText('Added: history.limit');
  await expect(preview).toContainText('Unknown (kept, unused): acme.unknown');
  await expect(preview).toContainText('Rejected: history.mergeWindowMs');
  await preview.getByRole('button', { name: 'Import' }).click();
  await expect(page.getByText('Settings imported into This machine')).toBeVisible();

  await search(page).fill('undo limit');
  await expect(
    setting(page, 'history.limit').getByRole('textbox', { name: 'Undo limit' }),
  ).toHaveValue('42');
});

test('edits settings.json as JSON with completion', async ({ page }) => {
  await open(page);
  await openSettings(page);
  await dialog(page).getByRole('button', { name: 'Edit as JSON' }).click();
  await page.getByRole('menuitem', { name: 'Project settings (settings.json)' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /settings\.json/ })).toBeVisible();

  const editor = page.locator('.monaco-editor').first();
  await editor.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('{\n"@nanoforge/viewport.z');
  await page.keyboard.press('Control+Space');
  await expect(
    page.locator('.suggest-widget').getByText('@nanoforge/viewport.zoom', { exact: false }),
  ).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('Escape');
});
