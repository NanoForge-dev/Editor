import { expandFolders, panelTab, resetLayout } from './helpers';
import { type Locator, type Page, expect, test } from './test';

const openPong = async (page: Page) => {
  await page.goto('/');
  await page.getByLabel('Project folder').fill('pong');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.waitForURL(/\/project\//);
  await expect(page.getByRole('tab', { name: 'Files' })).toBeVisible();
  await resetLayout(page);
};

/** Drags with real pointer events (the workbench uses pointer based drag and drop). */
const drag = async (page: Page, from: Locator, to: Locator | { x: number; y: number }) => {
  const source = (await from.boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  const target =
    'x' in to
      ? to
      : await (async () => {
          const box = (await to.boundingBox())!;
          return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        })();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await page.mouse.up();
};

/** The stripe group (one per dock slot) holding a panel's icon. */
const stackOf = (page: Page, tab: string) =>
  panelTab(page, tab).locator('xpath=ancestor::*[@data-nf-drop="stack"][1]');

test('opens a project in the workbench', async ({ page }) => {
  await openPong(page);
  await expect(page.getByRole('tab', { name: 'Project' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: /pong-network-client/ })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: /apps/ })).toBeVisible();
});

test('lists recent projects and removes one from the list', async ({ page }) => {
  await openPong(page);
  await page.goto('/');
  const pong = page
    .getByRole('region', { name: 'Recent' })
    .getByRole('listitem')
    .filter({ hasText: /\.workspace[\w-]*\/pong\b/ });
  await expect(pong).toBeVisible();
  await pong.getByRole('button', { name: 'Remove pong-network from the recent projects' }).click();
  await expect(pong).toHaveCount(0);
});

test('moves, resizes and floats docks, undoes, and restores the layout after reload', async ({
  page,
}) => {
  await openPong(page);

  await drag(page, panelTab(page, 'History'), panelTab(page, 'Console'));
  await expect(stackOf(page, 'Console')).toHaveAttribute('data-slot', 'bottom');
  await expect(page.locator('[data-slot="bottom"][data-nf-drop="stack"]').first()).toHaveAttribute(
    'data-contains',
    /history/,
  );

  const column = page.locator('[data-nf-part="left"]');
  const before = (await column.boundingBox())!.width;
  const splitter = (await page
    .getByRole('separator', { name: 'Resize left column' })
    .boundingBox())!;
  await page.mouse.move(splitter.x + 2, splitter.y + splitter.height / 2);
  await page.mouse.down();
  await page.mouse.move(splitter.x + 82, splitter.y + splitter.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => Math.round((await column.boundingBox())!.width))
    .toBe(Math.round(before + 80));

  await panelTab(page, 'Console').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Float' }).click();
  await expect(page.getByRole('dialog', { name: 'Floating panel' })).toBeVisible();

  await page.locator('[data-nf-part="screen"]').click();
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('dialog', { name: 'Floating panel' })).toHaveCount(0);
  await expect(page.locator('[data-slot="bottom"][data-nf-drop="stack"]').first()).toHaveAttribute(
    'data-contains',
    /console\.console/,
  );

  await drag(page, panelTab(page, 'Console'), { x: 700, y: 300 });
  await expect(page.getByRole('dialog', { name: 'Floating panel' })).toBeVisible();
  await page.waitForTimeout(900); // layout saves are debounced
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Files' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Floating panel' })).toBeVisible();
  await expect(page.locator('[data-slot="bottom"][data-nf-drop="stack"]').first()).toHaveAttribute(
    'data-contains',
    /history/,
  );
  expect(Math.round((await page.locator('[data-nf-part="left"]').boundingBox())!.width)).toBe(
    Math.round(before + 80),
  );
});

test('shows and hides panels from the tool window stripes, and docks one bottom right', async ({
  page,
}) => {
  await openPong(page);
  const files = panelTab(page, 'Files');
  const tree = page.getByRole('tree', { name: 'Project files' });
  await expect(files).toHaveAttribute('aria-selected', 'true');
  await expect(tree).toBeVisible();

  await files.click();
  await expect(files).toHaveAttribute('aria-selected', 'false');
  await expect(tree).toHaveCount(0);
  await files.click();
  await expect(tree).toBeVisible();

  await page.getByRole('button', { name: 'Hide Files' }).click();
  await expect(tree).toHaveCount(0);
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Panels' }).click();
  await page.getByRole('menuitem', { name: 'Files', exact: true }).click();
  await expect(tree).toBeVisible();

  await panelTab(page, 'Problems').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Move to' }).click();
  await page.getByRole('menuitem', { name: 'Bottom right' }).click();
  await expect(
    page
      .getByRole('navigation', { name: 'Right tool windows' })
      .getByRole('tablist', { name: 'Bottom right panels' })
      .getByRole('tab', { name: 'Problems' }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('region', { name: 'Problems' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Console' })).toBeVisible();

  await resetLayout(page);
  await page.waitForTimeout(900); // layout saves are debounced
});

test('runs a local plugin built against the shared runtime', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (message) => logs.push(message.text()));
  await openPong(page);
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Say hello twice' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect
    .poll(() =>
      logs.some((line) => line.includes('Eligible apps: pong-network-client, pong-network-server')),
    )
    .toBe(true);
});

test('checks a file with TypeScript in the code worker', async ({ page }) => {
  await openPong(page);
  await expandFolders(page, 'apps', 'client', 'src');
  await page.getByRole('treeitem', { name: 'main.ts' }).dblclick();
  await expect(page.locator('.squiggly-error').first()).toBeVisible({ timeout: 30_000 });
});

test('explains a project that cannot be opened and offers a way out', async ({ page }) => {
  await page.goto('/project/unknown-project-id');
  await expect(page.getByRole('heading', { name: 'This project is not open' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to projects' }).click();
  await expect(page.getByLabel('Project folder')).toBeVisible();
});

test('opens a project from a link (nf editor <folder>)', async ({ page }) => {
  await page.goto('/load?path=pong');
  await page.waitForURL(/\/project\//);
  await expect(page.getByRole('tab', { name: 'Files' })).toBeVisible();

  await page.goto('/load?path=missing-folder');
  await expect(page.getByText('No project folder at missing-folder')).toBeVisible();
  await page.getByRole('button', { name: 'Back to projects' }).click();
  await expect(page.getByLabel('Project folder')).toBeVisible();
});
