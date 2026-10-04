import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { resetLayout, showPanel } from './helpers';
import { type Page, expect, test } from './test';
import { PONG } from './workspace';

const MAIN = 'apps/client/src/main.ts';

const box = (page: Page) => page.getByRole('combobox', { name: 'Command palette' });
const results = (page: Page) => page.getByRole('listbox', { name: 'Results' });
const settings = (page: Page) => page.getByRole('dialog', { name: 'Settings' });
const shortcut = (page: Page, action: string) =>
  settings(page)
    .getByRole('list', { name: 'Keyboard shortcuts' })
    .getByRole('listitem', { name: action, exact: true });
const cursorLine = (page: Page) => page.locator('.monaco-editor .active-line-number');

const open = async (page: Page) => {
  await page.goto('/load?path=pong');
  await page.waitForURL(/\/project\//);
  await expect(page.getByRole('tab', { name: 'Files' })).toBeVisible();
  await resetLayout(page);
};

const openKeymap = async (page: Page) => {
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Keyboard shortcuts…' }).click();
  await expect(settings(page).getByRole('list', { name: 'Keyboard shortcuts' })).toBeVisible();
  await settings(page).getByRole('button', { name: 'Save changes to' }).click();
  await page.getByRole('option', { name: 'This machine' }).click();
};

const find = async (page: Page, text: string) =>
  settings(page).getByRole('textbox', { name: 'Search shortcuts' }).fill(text);

/** Records a shortcut in the recorder dialog, which is open. */
const record = async (page: Page, ...keys: string[]) => {
  const recorder = page.getByRole('textbox', { name: 'Shortcut', exact: true });
  await expect(recorder).toBeFocused();
  for (const key of keys) await page.keyboard.press(key);
};

test('palette: runs commands, recent ones first, from where the focus was', async ({ page }) => {
  await open(page);
  await page.locator('[data-nf-part="screen"]').click();

  await page.keyboard.press('Control+Shift+p');
  await expect(box(page)).toBeFocused();
  await expect(box(page)).toHaveValue('>');
  await box(page).pressSequentially('open panel');
  await expect(results(page).getByRole('option', { name: /^View: Open panel/ })).toHaveCount(0);
  await box(page).fill('>rst lay');
  await expect(results(page).getByRole('option').first()).toHaveText(/View: Reset layout/);
  await page.keyboard.press('Enter');
  await expect(box(page)).toHaveCount(0);
  await expect(page.getByText('Layout reset to default').last()).toBeVisible();

  await page.keyboard.press('Control+Shift+p');
  await expect(results(page).getByRole('option').first()).toHaveText(/View: Reset layout/);
  await box(page).fill('>panels problems');
  await expect(results(page).getByRole('option').first()).toHaveText(/View › Panels: Problems/);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name: 'Problems' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await showPanel(page, 'History');
  await page.getByRole('textbox', { name: 'Search changes' }).click();
  await page.keyboard.press('Control+Shift+p');
  await box(page).fill('>close panel');
  await results(page)
    .getByRole('option', { name: /View: Close panel/ })
    .click();
  await expect(page.getByRole('tab', { name: 'History' })).toHaveCount(0);

  await page.keyboard.press('Control+Shift+p');
  await page.keyboard.press('Escape');
  await expect(box(page)).toHaveCount(0);
  await resetLayout(page);
  await page.waitForTimeout(900);
});

test('palette: opens a file by a fuzzy name, goes to a line and to a symbol', async ({ page }) => {
  await open(page);
  await page.locator('[data-nf-part="screen"]').click();

  await page.keyboard.press('Control+p');
  await expect(box(page)).toHaveValue('');
  await box(page).fill('clnt main');
  await expect(results(page).getByRole('option').first()).toHaveText(MAIN);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name: 'main.ts' })).toBeVisible();
  await expect(
    page.locator('.monaco-editor textarea, .monaco-editor .native-edit-context').first(),
  ).toBeFocused();

  await page.keyboard.press('Control+g');
  await expect(box(page)).toHaveValue(':');
  await box(page).pressSequentially('7:3');
  await expect(results(page).getByRole('option')).toHaveText(/Go to line 7, column 3/);
  await page.keyboard.press('Enter');
  await expect(cursorLine(page)).toHaveText('7');

  const text = readFileSync(join(PONG, MAIN), 'utf8');
  const mainLine = text.split('\n').findIndex((line) => line.includes('export const main')) + 1;
  await page.keyboard.press('Control+Shift+o');
  await expect(box(page)).toHaveValue('@');
  await expect(results(page).getByRole('option').first()).toBeVisible();
  await box(page).pressSequentially('main');
  await expect(results(page).getByRole('option').first()).toHaveText(
    new RegExp(`^main.*line ${mainLine}$`),
  );
  await page.keyboard.press('Enter');
  await expect(cursorLine(page)).toHaveText(String(mainLine));

  await page.getByRole('tab', { name: 'main.ts' }).click({ button: 'middle' });
  await page.waitForTimeout(900);
});

test('keymap: chords, conflicts, conditions, removals, presets, kept on this machine', async ({
  page,
}) => {
  await open(page);
  await openKeymap(page);

  await find(page, 'reset layout');
  const reset = shortcut(page, 'View: Reset layout');
  await reset.getByRole('button', { name: 'Add shortcut' }).click();
  await record(page, 'Control+k', 'Control+l');
  await expect(page.getByRole('textbox', { name: 'Shortcut', exact: true })).toHaveText(
    'Ctrl+K Ctrl+L',
  );
  await page.getByRole('button', { name: 'Save shortcut' }).click();
  await expect(reset).toContainText('Ctrl+K Ctrl+L');
  await expect(reset).toContainText('You');

  await reset.getByRole('button', { name: 'Edit shortcut Ctrl+K Ctrl+L' }).click();
  await page.getByRole('textbox', { name: 'Condition' }).fill('((');
  await expect(page.getByRole('alert').filter({ hasText: "can't be read" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save shortcut' })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Condition' }).fill('!runtime.active');
  await page.getByRole('button', { name: 'Save shortcut' }).click();
  await expect(reset).toContainText('when !runtime.active');

  await find(page, '');
  await find(page, 'toggle light');
  const theme = shortcut(page, 'View: Toggle light/dark theme');
  await theme.getByRole('button', { name: 'Add shortcut' }).click();
  await record(page, 'F6');
  await expect(page.getByRole('alert').filter({ hasText: 'Already used by' })).toContainText(
    'Focus next part',
  );
  await page.getByRole('button', { name: 'Keep both' }).click();
  await expect(theme).toContainText('Conflict');
  await find(page, '');
  await settings(page).getByRole('checkbox', { name: 'Conflicts' }).check();
  await expect(
    settings(page).getByRole('list', { name: 'Keyboard shortcuts' }).getByRole('listitem'),
  ).toHaveCount(2);
  await theme.getByRole('button', { name: 'Edit shortcut F6' }).click();
  await page.getByRole('button', { name: 'Replace' }).click();
  await expect(
    settings(page).getByRole('list', { name: 'Keyboard shortcuts' }).getByRole('listitem'),
  ).toHaveCount(0);
  await settings(page).getByRole('checkbox', { name: 'Conflicts' }).uncheck();
  await find(page, 'focus next part');
  const next = shortcut(page, 'View: Focus next part');
  await expect(next.locator('kbd')).toHaveCount(0);
  await next.getByRole('button', { name: 'Reset' }).click();
  await expect(next.locator('kbd')).toHaveText('F6');
  await find(page, 'toggle light');
  await theme.getByRole('button', { name: 'Remove shortcut F6' }).click();
  await expect(theme.locator('kbd')).toHaveCount(0);

  await find(page, 'focus previous');
  const previous = shortcut(page, 'View: Focus previous part');
  await previous.getByRole('button', { name: 'Remove shortcut Shift+F6' }).click();
  await expect(previous.locator('kbd')).toHaveCount(0);

  await settings(page).getByRole('button', { name: 'Preset' }).click();
  await expect(page.getByRole('option', { name: 'Hello keys' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'VS Code' })).toBeVisible();
  await page.getByRole('option', { name: 'Godot' }).click();
  await find(page, 'run: stop');
  await expect(shortcut(page, 'Run: Stop')).toContainText('F8');
  await expect(shortcut(page, 'Run: Stop')).toContainText('Godot');

  await settings(page).getByRole('button', { name: 'OK' }).click();
  await expect(settings(page)).toHaveCount(0);
  await page.locator('[data-nf-part="screen"]').click();
  await page.keyboard.press('Control+k');
  await page.keyboard.press('Control+l');
  await expect(page.getByText('Layout reset to default').last()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Files' })).toBeVisible();
  await openKeymap(page);
  await expect(settings(page).getByRole('button', { name: 'Preset' })).toContainText('Godot');
  await settings(page).getByRole('checkbox', { name: 'Changed' }).check();
  await expect(
    settings(page).getByRole('list', { name: 'Keyboard shortcuts' }).getByRole('listitem'),
  ).toHaveCount(2);
  await expect(reset).toContainText('Ctrl+K Ctrl+L');
  await expect(previous.locator('kbd')).toHaveCount(0);
  await settings(page).getByRole('button', { name: 'Cancel' }).click();
});
