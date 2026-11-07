import { expandFolders, openProject, resetLayout, saved } from './helpers';
import { expect, test } from './test';

test.beforeEach(async ({ page }) => {
  await openProject(page, 'pong');
  await page.waitForURL(/\/project\//);
  await resetLayout(page);
});

test.afterEach(async ({ page }) => {
  await resetLayout(page);
  await saved(page);
});

test('moves between tool window icons with the arrow keys', async ({ page }) => {
  const stripe = page.getByRole('tablist', { name: 'Left top panels' });
  const tabs = stripe.getByRole('tab');
  await expect(tabs.nth(1)).toBeVisible();
  const first = tabs.first();
  await first.focus();
  await page.keyboard.press('ArrowDown');
  await expect(tabs.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(first).toBeFocused();
  await page.keyboard.press('End');
  await expect(tabs.last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(first).toBeFocused();
});

test('browses the file grid from the keyboard', async ({ page }) => {
  await expandFolders(page, 'apps', 'client', 'assets');
  const grid = page.getByRole('listbox', { name: 'Files in apps/client/assets' });
  await grid.focus();
  await page.keyboard.press('ArrowRight');
  const tiles = grid.getByRole('option');
  await expect(tiles.first()).toBeFocused();
  await page.keyboard.press('Space');
  await expect(tiles.first()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Backspace');
  await expect(page.getByRole('listbox', { name: 'Files in apps/client' })).toBeVisible();
});

test('keeps the focus when a panel is hidden, and moves it into one shown from its icon', async ({
  page,
}) => {
  const filesTab = page.getByRole('tablist', { name: 'Left top panels' }).getByRole('tab', {
    name: 'Files',
  });
  await page.getByRole('button', { name: 'Hide Files' }).click();
  await expect(filesTab).toBeFocused();
  await page.keyboard.press('Enter');
  await filesTab.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Hide', exact: true }).click();
  await expect(filesTab).toBeFocused();
  await page.keyboard.press('Enter');
  await expect
    .poll(() =>
      page.evaluate(
        () => !!document.activeElement?.closest('[data-nf-instance="file-manager.files"]'),
      ),
    )
    .toBe(true);
});

test('resizes a column from the keyboard in one undo step', async ({ page }) => {
  const column = page.locator('[data-nf-part="left"]');
  const before = Math.round((await column.boundingBox())!.width);
  const splitter = page.getByRole('separator', { name: 'Resize left column' });
  await expect(splitter).toHaveAttribute('aria-valuemin', '120');
  await splitter.focus();
  for (let press = 0; press < 3; press++) await page.keyboard.press('ArrowRight');
  await expect.poll(async () => Math.round((await column.boundingBox())!.width)).toBe(before + 30);
  await expect(splitter).toHaveAttribute('aria-valuenow', String(before + 30));

  await page.locator('[data-nf-part="screen"]').click();
  await page.keyboard.press('Control+z');
  await expect.poll(async () => Math.round((await column.boundingBox())!.width)).toBe(before);
});

test('opens the menu of a tree row from the keyboard', async ({ page }) => {
  await expandFolders(page, 'apps');
  /**
   * Shift+F10 and the menu key make the browser fire `contextmenu` at the focused element, the
   * tree; Playwright's synthetic keys do not, so the test fires it the same way.
   */
  await page.evaluate(() =>
    document.activeElement?.dispatchEvent(
      new PointerEvent('contextmenu', { bubbles: true, cancelable: true, pointerType: '' }),
    ),
  );
  await expect(page.getByRole('menuitem', { name: 'Rename…' })).toBeVisible();
  await page.keyboard.press('Escape');
});
