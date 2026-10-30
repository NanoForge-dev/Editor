import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { openProject, resetLayout, saved } from './helpers';
import { type Page, expect, test } from './test';
import { PONG } from './workspace';

const APPS = join(PONG, 'apps');
const COMPONENTS = join(APPS, 'client/src/components');

/** Every file under a folder, with its bytes (images too: not as text). */
const snapshot = (dir = APPS): Map<string, string> =>
  new Map(
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory()
        ? [...snapshot(path)]
        : [[path, readFileSync(path).toString('base64')] as const];
    }),
  );

let original: Map<string, string>;
test.beforeEach(() => {
  original = snapshot();
});
test.afterEach(async ({ page }) => {
  for (const path of snapshot().keys()) if (!original.has(path)) rmSync(path);
  for (const [path, bytes] of original) writeFileSync(path, Buffer.from(bytes, 'base64'));
  await saved(page);
});

const report = (page: Page) => page.getByRole('region', { name: 'Adapt to the editor' });
/** The report starts collapsed. */
const expand = async (page: Page) =>
  report(page).getByRole('button', { name: 'Show suggestions' }).click({ timeout: 30_000 });
const card = (page: Page, title: string, app: string) =>
  report(page).getByRole('listitem', { name: title }).filter({ hasText: app });

test('the report splits a file of components, previewed, then undone in one step', async ({
  page,
}) => {
  await openProject(page, 'pong');
  await page.waitForURL(/\/project\//);
  await resetLayout(page);
  await page.getByRole('tab', { name: 'Project', exact: true }).click();
  await expand(page);

  await expect(card(page, 'Register the editor library', 'pong-network-client')).toBeVisible({
    timeout: 30_000,
  });
  const split = card(page, 'Split components.ts', 'pong-network-client');
  await expect(split).toBeVisible({ timeout: 30_000 });
  await split.getByRole('button', { name: 'Split into one file each…' }).click();

  const preview = page.getByRole('dialog', { name: 'Split components.ts' });
  await expect(
    preview.getByRole('region', { name: 'apps/client/src/components/position.ts' }),
  ).toContainText('New');
  await expect(
    preview.getByRole('region', { name: 'apps/client/src/components/components.ts' }),
  ).toContainText('Removed');
  expect(existsSync(join(COMPONENTS, 'position.ts'))).toBe(false);
  await preview.getByRole('button', { name: 'Apply' }).click();

  await expect.poll(() => existsSync(join(COMPONENTS, 'components.ts'))).toBe(false);
  expect(readFileSync(join(COMPONENTS, 'position.ts'), 'utf8')).toContain('export class Position');
  expect(readFileSync(join(APPS, 'client/src/systems/systems.ts'), 'utf8')).toContain(
    'from "../components/position"',
  );
  await expect(split).toHaveCount(0, { timeout: 15_000 });
  await expect(
    card(page, 'circle-component.ts imports main.ts', 'pong-network-client'),
  ).toBeVisible();

  await page.locator('.overview').click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('Control+z');
  await expect.poll(() => snapshot()).toEqual(original);
});

test('a suggestion is dismissed for the project', async ({ page }) => {
  await openProject(page, 'pong');
  await page.waitForURL(/\/project\//);
  await page.getByRole('tab', { name: 'Project', exact: true }).click();
  await expand(page);
  const install = report(page).getByRole('listitem', { name: 'Install the dependencies' });
  await expect(install).toBeVisible({ timeout: 30_000 });
  await install.getByRole('button', { name: 'Dismiss' }).click();
  await expect(install).toHaveCount(0);
  await saved(page);
  await page.reload();
  await page.getByRole('tab', { name: 'Project', exact: true }).click();
  await expand(page);
  await expect(card(page, 'Register the editor library', 'pong-network-client')).toBeVisible({
    timeout: 30_000,
  });
  await expect(install).toHaveCount(0);
});
