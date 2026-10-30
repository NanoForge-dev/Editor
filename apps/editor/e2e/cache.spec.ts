import { expandFolders, openProject, resetLayout, saved } from './helpers';
import { type Page, expect, test } from './test';

/** Files kept in the browser's cache (OPFS), every user together. */
const keptFiles = (page: Page) =>
  page.evaluate(async () => {
    let count = 0;
    try {
      const layout = await (
        await navigator.storage.getDirectory()
      )
        .getDirectoryHandle('nanoforge-editor')
        .then((root) => root.getDirectoryHandle('v2'));
      for await (const user of (
        layout as unknown as { values(): AsyncIterable<FileSystemDirectoryHandle> }
      ).values()) {
        const blobs = await user.getDirectoryHandle('blobs');
        for await (const name of (blobs as unknown as { keys(): AsyncIterable<string> }).keys())
          if (name) count++;
      }
    } catch {}
    return count;
  });

const openMain = async (page: Page) => {
  await expandFolders(page, 'apps', 'client', 'src');
  await page
    .getByRole('tree', { name: 'Project files' })
    .getByRole('treeitem', { name: 'main.ts', exact: true })
    .dblclick();
  await expect(page.getByRole('tab', { name: 'main.ts' })).toBeVisible();
};

test('keeps project files in the browser and reads none of them again after a reload', async ({
  page,
}) => {
  test.setTimeout(90_000);
  /** File reads the page asks the server for (RPC calls are HTTP requests). */
  const reads: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('fs.readMany')) reads.push(request.url());
  });
  await openProject(page, 'pong');
  await page.waitForURL(/\/project\//);
  await resetLayout(page);
  await openMain(page);
  await expect.poll(() => keptFiles(page), { timeout: 15_000 }).toBeGreaterThan(5);
  /** The code worker and the code editor's type information fill the cache in the background. */
  await page.waitForTimeout(3000);
  /** The first visit reads the files from the server: the check below can fail. */
  expect(reads.length).toBeGreaterThan(0);

  reads.length = 0;
  await page.reload();
  await expect(page.getByRole('tab', { name: 'main.ts' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('tab', { name: 'main.ts' }).click();
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('NanoforgeFactory', {
    timeout: 15_000,
  });
  await page.waitForTimeout(3000);
  expect(reads).toEqual([]);

  await page.locator('[data-nf-part="screen"]').click();
  await page.keyboard.press('Control+Alt+s');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog
    .getByRole('tree', { name: 'Settings categories' })
    .getByRole('treeitem', { name: 'Storage', exact: true })
    .click();
  const kept = dialog.getByRole('list', { name: 'Kept projects' });
  await expect(kept.getByRole('listitem').filter({ hasText: 'pong-network' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Clear the files kept of pong-network' }).click();
  await expect(kept.getByRole('listitem').filter({ hasText: 'pong-network' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'main.ts' }).click({ button: 'middle' });
  await resetLayout(page);
  await saved(page);
});
