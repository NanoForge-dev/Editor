import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { type Page, expect, test } from './test';
import { PONG } from './workspace';

const panel = (page: Page) => page.getByRole('region', { name: 'History', exact: true });
const section = (page: Page, label: string) =>
  page.getByRole('region', { name: `History of ${label}` });
const files = (page: Page) => page.getByRole('tree', { name: 'Project files' });
const row = (page: Page, name: string) => files(page).getByRole('treeitem', { name, exact: true });

const open = async (page: Page) => {
  await page.goto('/load?path=pong');
  await page.waitForURL(/\/project\//);
  await expect(row(page, 'apps')).toBeVisible();
};

test('follows the focused history, jumps to steps, searches and clears', async ({ page }) => {
  await open(page);
  await row(page, 'history').click();
  await page.keyboard.press('ArrowRight');
  await row(page, 'format.ts').click();
  const filesHistory = section(page, 'Files');
  for (let i = 1; i <= 3; i++) {
    await page.keyboard.press('Control+d');
    await expect(filesHistory.getByRole('button', { name: /^Copy format/ })).toHaveCount(i);
  }
  await expect(section(page, 'Layout')).toHaveCount(0);

  const steps = filesHistory.getByRole('button', { name: /^Copy format/ });
  await steps.first().click();
  await expect.poll(() => existsSync(join(PONG, 'history/format copy copy.ts'))).toBe(false);
  expect(existsSync(join(PONG, 'history/format copy.ts'))).toBe(true);
  await expect(steps.first()).toHaveAttribute('aria-current', 'step');
  await steps.last().click();
  await expect.poll(() => existsSync(join(PONG, 'history/format copy copy copy.ts'))).toBe(true);

  await panel(page).getByRole('switch', { name: 'All' }).click();
  await expect(section(page, 'Layout')).toBeVisible();
  await panel(page).getByLabel('Search changes').fill('nothing like this');
  await expect(filesHistory.getByRole('button', { name: /^Copy/ })).toHaveCount(0);
  await panel(page).getByLabel('Search changes').fill('');

  await filesHistory.getByRole('button', { name: 'Clear the history of Files' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear' }).click();
  await expect(filesHistory.getByRole('button', { name: /^Copy/ })).toHaveCount(0);
});

test('expands grouped steps', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Help' }).click();
  await page.getByRole('menuitem', { name: 'Say hello twice' }).click();
  await panel(page).getByRole('switch', { name: 'All' }).click();
  const hello = section(page, 'Hello');
  await hello.getByRole('button', { name: 'Show 2 steps' }).click();
  await expect(hello.getByRole('list', { name: 'Steps of Say hello twice' })).toContainText(
    'Hello again',
  );
});

test('previews document edits and keeps them across reloads', async ({ page }) => {
  await open(page);
  await row(page, 'history').click();
  await page.keyboard.press('ArrowRight');
  await row(page, 'format.ts').dblclick();
  await expect(page.locator('.monaco-editor .view-lines').first()).toContainText('value', {
    timeout: 30_000,
  });
  await page.locator('.monaco-editor .view-lines').first().click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('export const   spaced   =   2');
  await page.keyboard.press('Shift+Alt+F');

  const document = section(page, 'format.ts');
  const step = document.getByRole('button', { name: /^Format with Prettier/ });
  await expect(step).toBeVisible({ timeout: 20_000 });
  await step.hover();
  const preview = document.getByRole('note', { name: 'Change preview' });
  await expect(preview.getByLabel('Before')).toContainText('export const   spaced   =   2');
  await expect(preview.getByLabel('After')).toContainText('export const spaced = 2;');

  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole('tab', { name: 'Script' }).click();
  await page.getByRole('tab', { name: 'format.ts' }).click();
  await page.locator('.monaco-editor .view-lines').first().click();
  await expect(
    section(page, 'format.ts').getByRole('button', { name: /^Format with Prettier/ }),
  ).toBeVisible({
    timeout: 20_000,
  });
});
