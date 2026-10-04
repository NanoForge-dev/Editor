import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { type Page, expect, test } from './test';
import { GAME } from './workspace';

const SCRATCH = 'apps/client/src/scratch';

test.skip(!existsSync(join(GAME, 'package.json')), 'needs a built engine (NANOFORGE_ENGINE)');

const onDisk = (name: string) => readFileSync(join(GAME, SCRATCH, `${name}.ts`), 'utf8');
/** Visible text of the editor (Monaco renders spaces as no-break spaces). */
const editorText = (page: Page) =>
  page
    .locator('.monaco-editor .view-lines')
    .first()
    .innerText()
    .then((text) => text.replace(/\u00a0/g, ' '));

const openScratch = async (page: Page, name: string) => {
  await page.goto('/load?path=game');
  await page.waitForURL(/\/project\//);
  for (const folder of ['apps', 'client', 'src', 'scratch']) {
    await page.getByRole('treeitem', { name: folder, exact: true }).click();
    await page.keyboard.press('ArrowRight');
  }
  await page.getByRole('treeitem', { name: `${name}.ts`, exact: true }).dblclick();
  await expect(page.getByRole('tab', { name: 'Script' })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => editorText(page), { timeout: 30_000 }).toContain('NanoforgeFactory');
  await page.locator('.monaco-editor .view-lines').first().click();
};

const typeAtEnd = async (page: Page, text: string) => {
  await page.keyboard.press('Control+End');
  await page.keyboard.type(text);
};

test('edits, marks, saves and restores unsaved changes', async ({ page }) => {
  test.setTimeout(90_000);
  await openScratch(page, 'edit');
  const dirty = page.getByRole('tab', { name: /edit\.ts/ }).getByLabel('Unsaved changes');

  await typeAtEnd(page, "\nexport const broken: number = 'x';");
  await expect(dirty).toBeVisible();
  await expect(page.locator('.squiggly-error').first()).toBeVisible({ timeout: 20_000 });

  await page.keyboard.press('Control+s');
  await expect(dirty).toBeHidden();
  expect(onDisk('edit')).toContain("export const broken: number = 'x';");

  await typeAtEnd(page, '\n// kept across reloads');
  await page.waitForTimeout(1000);
  await page.reload();
  await page.getByRole('tab', { name: 'Script' }).click();
  await expect.poll(() => editorText(page), { timeout: 30_000 }).toContain('kept across reloads');
  await expect(dirty).toBeVisible();
  expect(onDisk('edit')).not.toContain('kept across reloads');
});

test('goes to the definition of an engine API, read-only', async ({ page }) => {
  await openScratch(page, 'definition');
  await page.keyboard.press('Control+Home');
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Control+k');
  await page.keyboard.press('Control+i');
  await expect(page.locator('.monaco-hover').first()).toContainText('NanoforgeFactory', {
    timeout: 20_000,
  });
  await page.keyboard.press('Escape');
  await page.keyboard.press('F12');
  const library = page.getByRole('tab', { name: /index\.d\.ts/ });
  await expect(library).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 });
  await expect.poll(() => editorText(page)).toContain('NanoforgeFactory');
  await page.keyboard.type('nope');
  await expect(library.getByLabel('Unsaved changes')).toHaveCount(0);
});

test("formats with the project's Prettier and organizes imports", async ({ page }) => {
  await openScratch(page, 'format');
  await typeAtEnd(page, '\nexport const   spaced   =   { a:1 }');
  await page.keyboard.press('Shift+Alt+F');
  await expect
    .poll(() => editorText(page), { timeout: 20_000 })
    .toContain('export const spaced = { a: 1 };');

  await page.keyboard.press('Control+Home');
  await page.keyboard.type('import { Library } from "@nanoforge-dev/common";\n');
  await page.keyboard.press('Shift+Alt+O');
  await expect.poll(() => editorText(page), { timeout: 20_000 }).not.toContain('Library');
  await expect.poll(() => editorText(page)).toContain('NanoforgeFactory');
});

test('splits the editor to show two files side by side', async ({ page }) => {
  await openScratch(page, 'format');
  await page.keyboard.press('Control+Backslash');
  const groups = page.getByRole('region', { name: /Editor group/ });
  await expect(groups).toHaveCount(2);
  await page
    .getByRole('region', { name: 'Editor group 2' })
    .getByRole('button', { name: 'Close format.ts' })
    .click();
  await expect(groups).toHaveCount(1);
});

test('asks what to do when a file changes on disk during unsaved edits', async ({ page }) => {
  await openScratch(page, 'conflict');
  await typeAtEnd(page, '\n// mine');
  await page.waitForTimeout(500);
  writeFileSync(join(GAME, SCRATCH, 'conflict.ts'), `${onDisk('conflict')}// theirs\n`);

  const banner = page.getByRole('alert').filter({ hasText: 'changed on disk' });
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await banner.getByRole('button', { name: 'Compare' }).click();
  await expect(page.locator('.monaco-diff-editor')).toBeVisible();
  await banner.getByRole('button', { name: 'Keep mine' }).click();
  await expect(banner).toBeHidden();

  await page.locator('.monaco-editor .view-lines').first().click();
  await page.keyboard.press('Control+s');
  await expect.poll(() => onDisk('conflict')).toContain('// mine');
  expect(onDisk('conflict')).not.toContain('// theirs');
});

test('autosaves after a delay when the setting is on', async ({ page }) => {
  const settings = join(GAME, '.nanoforge/editor/settings.json');
  mkdirSync(join(GAME, '.nanoforge/editor'), { recursive: true });
  writeFileSync(
    settings,
    JSON.stringify({
      '@nanoforge/code-editor.autoSave.afterDelay': true,
      '@nanoforge/code-editor.autoSave.delayMs': 300,
    }),
  );
  try {
    await openScratch(page, 'autosave');
    await typeAtEnd(page, '\n// saved by itself');
    await expect.poll(() => onDisk('autosave'), { timeout: 10_000 }).toContain('saved by itself');
  } finally {
    rmSync(settings, { force: true });
  }
});

test('saves on focus loss, formatting on save', async ({ page }) => {
  const settings = join(GAME, '.nanoforge/editor/settings.json');
  mkdirSync(join(GAME, '.nanoforge/editor'), { recursive: true });
  writeFileSync(
    settings,
    JSON.stringify({
      '@nanoforge/code-editor.autoSave.onFocusLoss': true,
      '@nanoforge/code-editor.onSave.format': true,
    }),
  );
  try {
    await openScratch(page, 'focus');
    await typeAtEnd(page, '\nexport const   later   =   2');
    await page.getByRole('treeitem', { name: 'focus.ts', exact: true }).click();
    await expect
      .poll(() => onDisk('focus'), { timeout: 10_000 })
      .toContain('export const later = 2;');
  } finally {
    rmSync(settings, { force: true });
  }
});
