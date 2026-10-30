import { type Page, expect } from '@playwright/test';

/**
 * Puts the saved layout of the project back to the default with every panel (tests reuse
 * projects, and expect the panels of the full layout).
 */
export const resetLayout = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Layouts' }).click();
  await page.getByRole('menuitem', { name: 'All panels' }).click();
  await expect(page.getByText('Layout reset with all panels').last()).toBeVisible();
};

/** Expands folders of the Files tree, from the root (already expanded ones stay open). */
export const expandFolders = async (page: Page, ...folders: string[]): Promise<void> => {
  const tree = page.getByRole('tree', { name: 'Project files' });
  for (const folder of folders) {
    const row = tree.getByRole('treeitem', { name: folder, exact: true });
    await row.click();
    if ((await row.getAttribute('aria-expanded')) !== 'true')
      await page.keyboard.press('ArrowRight');
    await expect(row).toHaveAttribute('aria-expanded', 'true');
  }
};

/** A dock panel's icon in the tool window stripes. */
export const panelTab = (page: Page, name: string | RegExp) =>
  page
    .getByRole('navigation', { name: /tool windows$/ })
    .getByRole('tab', { name, exact: typeof name === 'string' });

/**
 * Shows a dock panel. Its icon is clicked only when the panel is not shown: a click on the
 * icon of a shown panel hides its dock.
 */
export const showPanel = async (page: Page, name: string | RegExp): Promise<void> => {
  const tab = panelTab(page, name);
  /** A panel the layout does not show (History, by default) opens from View › Panels. */
  if (typeof name === 'string' && !(await tab.count())) {
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Panels' }).click();
    await page.getByRole('menuitem', { name, exact: true }).click();
  }
  await expect(tab).toBeVisible();
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
};

/**
 * Opens a project by its folder, as `nf editor <folder>` does: through `/load`, confirming the
 * prompt a folder that is not a recent project gets (a relative path always gets it).
 */
export const openProject = async (page: Page, path: string): Promise<void> => {
  await page.goto(`/load?path=${encodeURIComponent(path)}`);
  await page.getByRole('button', { name: 'Trust and open', exact: true }).click();
};
