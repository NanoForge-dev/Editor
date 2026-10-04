import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { type Page, expect, test } from './test';
import { GAME } from './workspace';

const hasGame = existsSync(join(GAME, 'package.json'));

const run = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Run' }).getByRole('button', { name });
const view = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Game view' }).getByRole('button', { name });
const screenTab = (page: Page, name: string) =>
  page.getByRole('tablist', { name: 'Main screens' }).getByRole('tab', { name });

const openGame = async (page: Page) => {
  await page.goto('/load?path=game');
  await page.waitForURL(/\/project\//);
  await screenTab(page, 'Project').click();
  await expect(screenTab(page, 'Project')).toHaveAttribute('aria-selected', 'true');
};

const play = async (page: Page) => {
  await run(page, 'Play').click();
  await expect(run(page, 'Stop')).toBeVisible();
  await expect(page.locator('[data-nf-game] canvas').first()).toBeVisible({ timeout: 30_000 });
};

const stop = async (page: Page) => {
  await run(page, 'Stop').click();
  await expect(run(page, 'Play')).toBeVisible({ timeout: 15_000 });
};

test('shows the scene editor contributed for the project (the ECS 2D scene)', async ({ page }) => {
  await page.goto('/load?path=pong');
  await page.waitForURL(/\/project\//);
  await screenTab(page, 'Scene').click();
  await expect(page.getByRole('application', { name: '2D scene' })).toBeVisible();
});

test.describe('while playing', () => {
  test.skip(!hasGame, 'needs a built engine (NANOFORGE_ENGINE)');
  test.setTimeout(90_000);

  test('switches to the Game screen, focuses the game, and goes back on Stop', async ({ page }) => {
    await openGame(page);
    await play(page);
    await expect(screenTab(page, 'Game')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('application', { name: 'Running game' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('application', { name: 'Running game' })).not.toBeFocused();

    await run(page, 'Pause').click();
    await expect(page.locator('.dim')).toBeVisible();
    await run(page, 'Resume').click();
    await expect(page.locator('.dim')).toHaveCount(0);

    await stop(page);
    await expect(screenTab(page, 'Project')).toHaveAttribute('aria-selected', 'true');
  });

  test('sizes the game, shows stats and saves screenshots', async ({ page }) => {
    await openGame(page);
    await screenTab(page, 'Game').click();
    await view(page, 'Stats').click();
    await play(page);
    await page.getByRole('button', { name: 'Resolution' }).click();
    await page.getByRole('menuitem', { name: /1280 × 720/ }).click();
    const frame = page.getByRole('application', { name: 'Running game' });
    await expect.poll(async () => (await frame.boundingBox())?.width).toBe(1280);
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await expect.poll(async () => (await frame.boundingBox())?.width).toBe(960);

    await expect(page.getByRole('status', { name: 'Game stats' })).toContainText('tps', {
      timeout: 10_000,
    });

    await view(page, 'Screenshot').click();
    await expect(page.getByText('Screenshot saved')).toBeVisible();
    expect(readdirSync(join(GAME, 'screenshots')).some((name) => name.endsWith('.png'))).toBe(true);
    await stop(page);
  });

  test('maximizes on play when asked to', async ({ page }) => {
    await openGame(page);
    await screenTab(page, 'Game').click();
    await view(page, 'Maximize on play').click();
    await play(page);
    await expect(page.locator('[data-nf-part="left"]')).toHaveCount(0);
    await stop(page);
    await expect(page.locator('[data-nf-part="left"]')).toHaveCount(1);
  });

  test('pops the game out to another window and back', async ({ page, context }) => {
    await openGame(page);
    await play(page);
    const opened = context.waitForEvent('page');
    await view(page, 'Pop out').click();
    const popup = await opened;
    await expect(popup.locator('canvas').first()).toBeVisible();
    await expect(page.getByText('The game runs in another window')).toBeVisible();
    await page.getByRole('button', { name: 'Bring it back' }).click();
    await expect(page.locator('[data-nf-game] canvas').first()).toBeVisible();
    await stop(page);
  });
});
