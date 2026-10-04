import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type Page, expect, test } from './test';
import { PONG } from './workspace';

const files = (page: Page) => page.getByRole('tree', { name: 'Project files' });
const row = (page: Page, name: string) => files(page).getByRole('treeitem', { name, exact: true });

const open = async (page: Page) => {
  await page.goto('/load?path=pong');
  await page.waitForURL(/\/project\//);
  await expect(row(page, 'apps')).toBeVisible();
};

/** Expands folders from the root (`apps`, `client`, …). */
const expand = async (page: Page, ...folders: string[]) => {
  for (const folder of folders) {
    await row(page, folder).click();
    await page.keyboard.press('ArrowRight');
  }
};

const undo = (page: Page) => page.keyboard.press('Control+z');

test('shows the tree and a grid with thumbnails', async ({ page }) => {
  await open(page);
  await expand(page, 'apps', 'client', 'assets');
  const grid = page.getByRole('listbox', { name: 'Files in apps/client/assets' });
  const thumbnail = grid.getByRole('option', { name: /logo\.png/ }).locator('img');
  await expect(thumbnail).toBeVisible();
  await expect
    .poll(() => thumbnail.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(2);
});

test('hides .nfignore entries and excluded files, the toggle shows excluded ones', async ({
  page,
}) => {
  await open(page);
  await expect(row(page, 'secret')).toHaveCount(0);
  await expect(row(page, '.env')).toBeVisible();
  const prettierrc = files(page).getByRole('treeitem', { name: /^\.prettierrc/ });
  await expect(prettierrc).toHaveCount(0);

  await page.getByRole('button', { name: 'Show hidden files' }).click();
  await expect(prettierrc).toBeVisible();
  await expect(prettierrc).toContainText('hidden');
  await expect(row(page, 'secret')).toHaveCount(0);
  await page.getByRole('button', { name: 'Hide hidden files' }).click();
});

test('searches files by name', async ({ page }) => {
  await open(page);
  await page.getByLabel('Search files').fill('lgpng');
  await expect(row(page, 'logo.png')).toBeVisible();
  await expect(row(page, 'scratch')).toHaveCount(0);
  await page.getByLabel('Search files').fill('');
  await expect(row(page, 'scratch')).toBeVisible();
});

test('renames, moves, copies, duplicates and deletes, each undoable', async ({ page }) => {
  await open(page);
  await expand(page, 'scratch');
  const scratch = (name: string) => join(PONG, 'scratch', name);

  await row(page, 'rename-me.txt').click();
  await page.keyboard.press('F2');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('renamed.txt');
  await page.keyboard.press('Enter');
  await expect(row(page, 'renamed.txt')).toBeVisible();
  expect(existsSync(scratch('renamed.txt'))).toBe(true);
  await undo(page);
  await expect(row(page, 'rename-me.txt')).toBeVisible();

  await row(page, 'move-me.txt').dragTo(row(page, 'target'));
  await expect.poll(() => existsSync(scratch('target/move-me.txt'))).toBe(true);
  await undo(page);
  await expect.poll(() => existsSync(scratch('move-me.txt'))).toBe(true);

  await row(page, 'copy-me.txt').click();
  await page.keyboard.press('Control+c');
  await row(page, 'target').click();
  await page.keyboard.press('Control+v');
  await expect.poll(() => existsSync(scratch('target/copy-me.txt'))).toBe(true);
  await undo(page);
  await expect.poll(() => existsSync(scratch('target/copy-me.txt'))).toBe(false);

  await row(page, 'copy-me.txt').click();
  await page.keyboard.press('Control+d');
  await expect.poll(() => existsSync(scratch('copy-me copy.txt'))).toBe(true);
  await undo(page);
  await expect.poll(() => existsSync(scratch('copy-me copy.txt'))).toBe(false);

  await row(page, 'copy-me.txt').click();
  for (let i = 0; i < 3; i++) await page.keyboard.press('Control+d');
  await expect.poll(() => existsSync(scratch('copy-me copy copy copy.txt'))).toBe(true);
  for (let i = 0; i < 3; i++) await undo(page);
  await expect.poll(() => existsSync(scratch('copy-me copy.txt'))).toBe(false);

  await row(page, 'delete-me.txt').click();
  await page.keyboard.press('Delete');
  await expect.poll(() => existsSync(scratch('delete-me.txt'))).toBe(false);
  await expect(row(page, 'delete-me.txt')).toHaveCount(0);
  await undo(page);
  await expect.poll(() => existsSync(scratch('delete-me.txt'))).toBe(true);
  expect(readFileSync(scratch('delete-me.txt'), 'utf8')).toBe('delete\n');
});

test('creates from a template and imports dropped files', async ({ page }) => {
  await open(page);
  await expand(page, 'scratch');
  await row(page, 'scratch').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Greeting…' }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('hello.txt');
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
  await expect.poll(() => existsSync(join(PONG, 'scratch/hello.txt'))).toBe(true);
  expect(readFileSync(join(PONG, 'scratch/hello.txt'), 'utf8')).toBe('Hello from hello.txt!\n');

  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(['imported'], 'imported.txt', { type: 'text/plain' }));
    return data;
  });
  const target = row(page, 'target');
  await target.dispatchEvent('dragover', { dataTransfer: transfer });
  await target.dispatchEvent('drop', { dataTransfer: transfer });
  await expect.poll(() => existsSync(join(PONG, 'scratch/target/imported.txt'))).toBe(true);
});

test('shows installed packages read-only', async ({ page }) => {
  await open(page);
  const packages = page.getByRole('region', { name: 'Packages' });
  await expect(packages).toBeVisible();
  await packages.getByRole('treeitem', { name: 'nf_modules' }).click();
  await page.keyboard.press('ArrowRight');
  await packages.getByRole('treeitem', { name: 'physics' }).click();
  await page.keyboard.press('ArrowRight');
  await packages.getByRole('treeitem', { name: 'body.ts' }).click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: /^Copy Ctrl\+C/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /^Delete/ })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: /^Cut/ })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  expect(existsSync(join(PONG, 'nf_modules/physics/body.ts'))).toBe(true);
});

test('downloads a folder as .zip', async ({ page }) => {
  await open(page);
  await row(page, 'scratch').click({ button: 'right' });
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Download as .zip' }).click();
  expect((await download).suggestedFilename()).toBe('scratch.zip');
});
