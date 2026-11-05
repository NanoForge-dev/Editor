import { openProject, resetLayout, showPanel } from './helpers';
import { type Page, expect, test } from './test';

const openSettings = async (page: Page) => {
  await page.locator('[data-nf-part="screen"]').click();
  await page.keyboard.press('Control+Alt+s');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('treeitem', { name: 'Appearance' }).click();
  return dialog;
};
const variable = (page: Page, name: string) =>
  page.evaluate(
    (token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
    name,
  );

/** Puts the theme, the density and the icons back (account settings outlive the test). */
const restore = async (page: Page) => {
  const open = page.getByRole('dialog', { name: 'Settings' });
  if (await open.isVisible()) await open.getByRole('button', { name: 'Cancel' }).click();
  await expect(open).toBeHidden();
  const dialog = await openSettings(page);
  const panel = dialog.getByRole('region', { name: 'Appearance' });
  await panel.getByRole('radio', { name: 'NanoForge Dark' }).click();
  await panel.getByRole('radio', { name: 'Normal' }).click();
  await panel.getByRole('button', { name: 'Icon theme' }).click();
  await page.getByRole('option', { name: 'NanoForge', exact: true }).click();
  await dialog.getByRole('button', { name: 'OK' }).click();
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(900);
};

test('themes, density and icons from a plugin, chosen in Settings › Appearance', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openProject(page, 'pong');
  await page.waitForURL(/\/project\//);
  await resetLayout(page);
  try {
    const dialog = await openSettings(page);
    const panel = dialog.getByRole('region', { name: 'Appearance' });
    const themes = panel.getByRole('radiogroup', { name: 'Theme' });
    await expect(themes.getByRole('radio', { name: 'NanoForge Dark' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await themes.getByRole('radio', { name: 'Ocean' }).click();
    await panel.getByRole('radio', { name: 'Compact' }).click();
    await panel.getByRole('button', { name: 'Icon theme' }).click();
    await page.getByRole('option', { name: 'Ocean icons' }).click();
    await dialog.getByRole('button', { name: 'Apply' }).click();

    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.nfTheme))
      .toBe('acme-ocean');
    expect(await variable(page, '--nf-color-accent')).toBe('#176aa8');
    expect(await variable(page, '--nf-color-text')).toBe('#d8dde7');
    expect(await variable(page, '--nf-radius-control')).toBe('4px');
    expect(await variable(page, '--nf-control-height')).toBe('22px');

    await panel.getByRole('button', { name: 'Get more themes' }).click();
    const plugins = dialog.getByRole('region', { name: 'Plugins' });
    await expect(plugins.getByRole('textbox', { name: 'Search plugins' })).toHaveValue(
      'keywords:theme',
    );
    await expect(plugins.getByText('@acme/sunset').first()).toBeVisible();
    await expect(plugins.getByText('@acme/badge')).toHaveCount(0);
    /** The first result's details load and render: close once they are there. */
    await expect(plugins.getByRole('button', { name: 'Install' })).toBeVisible();
    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect(dialog).toBeHidden();

    await showPanel(page, 'Files');
    const tree = page.getByRole('tree', { name: 'Project files' });
    await expect(tree.getByRole('treeitem', { name: 'apps' }).locator('.nf-icon-file')).toHaveCount(
      1,
    );
  } finally {
    await restore(page);
  }
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.nfTheme))
    .toBe('nanoforge-dark');
  expect(await variable(page, '--nf-control-height')).toBe('26px');
});
