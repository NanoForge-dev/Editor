import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { openProject } from './helpers';
import { type Page, expect, test } from './test';
import { TUTORIAL } from './workspace';

const MAIN = join(TUTORIAL, 'src/main.ts');
const SYSTEM = join(TUTORIAL, 'src/systems/move-2d.system.ts');
const sources = existsSync(MAIN)
  ? { [MAIN]: readFileSync(MAIN, 'utf8'), [SYSTEM]: readFileSync(SYSTEM, 'utf8') }
  : {};

const bubble = (page: Page) =>
  page.getByRole('dialog').filter({ has: page.locator('#nf-tour-title') });
const step = (page: Page, title: string) =>
  expect(page.locator('#nf-tour-title')).toHaveText(title, { timeout: 30_000 });
const press = (page: Page, name: string) =>
  bubble(page).getByRole('button', { name, exact: true }).click();
const run = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Run' }).getByRole('button', { name, exact: false });

test.skip(
  !existsSync(join(TUTORIAL, 'package.json')),
  'needs a built CLI (NANOFORGE_CLI) and engine (NANOFORGE_ENGINE)',
);

test.afterEach(async ({ page }) => {
  const stop = run(page, 'Stop');
  if (await stop.isVisible().catch(() => false)) {
    await stop.click();
    await expect(run(page, 'Play')).toBeVisible({ timeout: 15_000 });
  }
  for (const [path, text] of Object.entries(sources)) writeFileSync(path, text);
  for (const folder of ['.git', 'dist'])
    rmSync(join(TUTORIAL, folder), { recursive: true, force: true });
});

test('the tutorial: from the welcome to a first commit', async ({ page }) => {
  test.setTimeout(240_000);
  /** A folder the tutorial did not make here is not trusted: open it once, as its user would. */
  await openProject(page, 'my-first-game');
  await page.waitForURL(/\/project\//);
  await page.goto('/');
  await page
    .getByRole('region', { name: 'Welcome to NanoForge' })
    .getByRole('button', { name: 'Start the tutorial' })
    .click();
  await page.waitForURL(/\/project\/[^?]+$/);

  await step(page, 'Your first game');
  await press(page, 'Next');
  await step(page, 'Screens');
  await press(page, 'Next');
  await step(page, 'The Scene screen');
  await page.getByRole('tab', { name: 'Scene', exact: true }).click();

  await step(page, 'Add an entity');
  await press(page, 'Show Hierarchy');
  await page.getByRole('button', { name: 'Add entity' }).click();
  await step(page, 'Select the ball');
  await expect
    .poll(() => readFileSync(MAIN, 'utf8'))
    .toContain('const entity = registry.spawnEntity();');
  await page
    .getByRole('tree', { name: 'Entities' })
    .getByRole('treeitem', { name: /^ball\b/ })
    .click();
  await press(page, 'Next');

  await step(page, 'Change a value');
  const speed = page
    .getByRole('region', { name: 'Velocity2D' })
    .getByRole('textbox', { name: 'x', exact: true });
  await speed.fill('6');
  await speed.press('Enter');

  await step(page, 'Fix the mistake');
  await press(page, 'Show problems');
  await expect(page.getByText("Property 'speed' does not exist")).toBeVisible();
  writeFileSync(SYSTEM, readFileSync(SYSTEM, 'utf8').replace('velocity.speed', 'velocity.x'));

  await step(page, 'Play');
  await run(page, 'Play').click();
  await step(page, 'Look inside the running game');
  await press(page, 'Show World');
  await expect(page.getByRole('region', { name: 'World', exact: true })).toBeVisible();
  await run(page, 'Stop').click();
  await expect(run(page, 'Play')).toBeVisible({ timeout: 15_000 });
  await press(page, 'Next');

  await step(page, 'Keep your work in git');
  await press(page, 'Initialize repository');
  await step(page, 'Commit');
  await press(page, 'Show Commit');
  const commit = page.getByRole('region', { name: 'Commit', exact: true });
  await commit
    .getByRole('region', { name: 'Unversioned files', exact: true })
    .getByRole('checkbox', { name: 'Include all: Unversioned files' })
    .check();
  await commit.getByRole('textbox', { name: 'Commit message' }).fill('my first game');
  await commit.getByRole('button', { name: 'Commit', exact: true }).click();

  await step(page, 'Done');
  await press(page, 'Done');
  await expect(bubble(page)).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.isConnected ?? true)).toBe(true);
  expect(existsSync(join(TUTORIAL, '.git'))).toBe(true);
});

test('Help › Tutorial replays the tour, and Escape ends it', async ({ page }) => {
  await openProject(page, 'my-first-game');
  await page.waitForURL(/\/project\//);
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Tutorial' }).click();
  await step(page, 'Your first game');
  await expect(bubble(page).getByText(/^Tutorial · 1 of \d+$/)).toBeVisible();
  await bubble(page).getByRole('button', { name: 'Next', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(bubble(page)).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.isConnected ?? true)).toBe(true);
});
