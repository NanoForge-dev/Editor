import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { expandFolders, panelTab, resetLayout, showPanel } from './helpers';
import { expect, test } from './test';
import { PONG } from './workspace';

/** Defects found by going through the editor by hand (2026-10-02), kept from coming back. */
const NOTES = join(PONG, 'scratch/notes.md');
const TODO = join(PONG, 'scratch/todo.md');

test.beforeEach(async ({ page }) => {
  await page.goto('/load?path=pong');
  await page.waitForURL(/\/project\//);
  await resetLayout(page);
});

test.afterEach(async ({ page }) => {
  rmSync(NOTES, { force: true });
  rmSync(TODO, { force: true });
  await resetLayout(page);
  await page.waitForTimeout(1500);
});

test('an image opens in a preview, not as text in the code editor', async ({ page }) => {
  await expandFolders(page, 'apps', 'client', 'assets');
  await page
    .getByRole('tree', { name: 'Project files' })
    .getByRole('treeitem', { name: 'logo.png' })
    .dblclick();
  const dialog = page.getByRole('dialog', { name: 'logo.png' });
  await expect(dialog.getByRole('img', { name: 'apps/client/assets/logo.png' })).toBeVisible();
  await expect(dialog.getByText('2 × 2')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).last().click();
  await expect(page.getByRole('tab', { name: 'Project' })).toHaveAttribute('aria-selected', 'true');
});

test('a new file takes the keyboard, and its tab follows a rename then closes on delete', async ({
  page,
}) => {
  const tree = page.getByRole('tree', { name: 'Project files' });
  const tabs = page.locator('[data-nf-part="screen"]').getByRole('tab');
  const apps = tree.getByRole('treeitem', { name: 'apps', exact: true });
  await apps.click();
  if ((await apps.getAttribute('aria-expanded')) === 'true') await page.keyboard.press('ArrowLeft');
  await expect(apps).toHaveAttribute('aria-expanded', 'false');
  await expandFolders(page, 'scratch');
  await tree.getByRole('treeitem', { name: 'scratch', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'File…', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').first().fill('notes.md');
  await page.keyboard.press('Enter');
  await expect(tabs.filter({ hasText: 'notes.md' })).toBeVisible();

  await expect(
    page.locator('.monaco-editor textarea, .monaco-editor .native-edit-context').first(),
  ).toBeFocused();
  await page.keyboard.type('# Notes');
  await expect(tabs.filter({ hasText: 'notes.md' }).getByLabel('Unsaved changes')).toBeVisible();

  await tree.getByRole('treeitem', { name: 'notes.md', exact: true }).click();
  await page.keyboard.press('F2');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('todo.md');
  await page.keyboard.press('Enter');
  await expect(tabs.filter({ hasText: 'todo.md' }).getByLabel('Unsaved changes')).toBeVisible();
  await expect(tabs.filter({ hasText: 'notes.md' })).toHaveCount(0);
  await expect(page.getByText('was deleted on disk')).toHaveCount(0);
  await expect(page.locator('.monaco-editor .view-lines').first()).toContainText('# Notes');

  await page.locator('.monaco-editor').first().click();
  await page.keyboard.press('Control+s');
  await expect.poll(() => existsSync(TODO)).toBe(true);
  await expect(tabs.filter({ hasText: 'todo.md' }).getByLabel('Unsaved changes')).toHaveCount(0);
  await tree.getByRole('treeitem', { name: 'todo.md', exact: true }).click();
  await page.keyboard.press('Delete');
  await expect(tabs.filter({ hasText: 'todo.md' })).toHaveCount(0);
});

test('every panel of a dock has its icon in the stripe, even in a narrow window', async ({
  page,
}) => {
  await showPanel(page, 'Commit');
  await expect(panelTab(page, 'Commit')).toBeInViewport();
  await expect(page.getByRole('heading', { name: 'Commit', level: 2 })).toBeVisible();
});

test('the screens do not cover the menus in a narrow window', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 600 });
  const help = await page.getByRole('button', { name: 'Help', exact: true }).boundingBox();
  const screens = await page.getByRole('tablist', { name: 'Main screens' }).boundingBox();
  expect(help!.x + help!.width).toBeLessThanOrEqual(screens!.x);
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Documentation' })).toBeVisible();
  await page.keyboard.press('Escape');
});
