import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { resetLayout, showPanel } from './helpers';
import { type Page, expect, test } from './test';
import { GAME } from './workspace';

const MAIN = join(GAME, 'apps/client/src/main.ts');

test.skip(!existsSync(join(GAME, 'package.json')), 'needs a built engine (NANOFORGE_ENGINE)');

const toolbar = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Run' }).getByRole('button', { name, exact: false });
const liveEntity = (page: Page, name: string) =>
  page
    .getByRole('tree', { name: 'Live entities' })
    .getByRole('treeitem', { name: new RegExp(`^${name}\\b`) });

test('shows the live world, edits it, applies it to the code and pauses a system', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const original = readFileSync(MAIN, 'utf8');
  try {
    await page.goto('/load?path=game');
    await page.waitForURL(/\/project\//);
    await resetLayout(page);
    await showPanel(page, 'Hierarchy');
    await expect(page.getByRole('tree', { name: 'Entities' })).toBeVisible();

    await toolbar(page, 'Play').click();
    await expect(toolbar(page, 'Pause')).toBeVisible({ timeout: 30_000 });
    await expect(liveEntity(page, 'terrainLine')).toBeVisible({ timeout: 15_000 });
    await expect(liveEntity(page, 'paddle2')).toBeVisible();
    await liveEntity(page, 'terrainLine').click();

    await showPanel(page, 'Inspector');
    const position = page.getByRole('region', { name: 'Position' });
    const x = position.getByRole('textbox', { name: 'x', exact: true });
    await expect(x).toHaveValue('955');
    await x.fill('900');
    await x.press('Enter');
    await expect(liveEntity(page, 'terrainLine')).toContainText('changed');
    await expect(x).toHaveValue('900');
    expect(readFileSync(MAIN, 'utf8')).toContain('new Position(955, 0)');
    await page.getByRole('button', { name: 'Apply to code' }).click();
    await expect
      .poll(() => readFileSync(MAIN, 'utf8'))
      .toContain('registry.addComponent(terrainLine, new Position(900, 0));');

    const applied = readFileSync(MAIN, 'utf8');
    await page
      .getByRole('tablist', { name: 'Main screens' })
      .getByRole('tab', { name: 'Scene', exact: true })
      .click();
    const line = page
      .getByRole('application', { name: '2D scene' })
      .getByRole('button', { name: 'terrainLine (rect)' });
    const box = (await line.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await showPanel(page, 'Hierarchy');
    await expect(liveEntity(page, 'terrainLine')).toContainText('changed');
    expect(readFileSync(MAIN, 'utf8')).toBe(applied);

    await showPanel(page, 'Systems');
    const move = page.getByRole('switch', { name: 'Run move' });
    await expect(move).toBeChecked();
    await move.click();
    await expect(move).not.toBeChecked();

    await showPanel(page, 'Hierarchy');
    await page.getByRole('button', { name: 'Running game' }).click();
    await page.getByRole('option', { name: 'Server (running)' }).click();
    await expect(
      page.getByRole('tree', { name: 'Live entities' }).getByRole('treeitem').first(),
    ).toBeVisible();

    await toolbar(page, 'Stop').click();
    await expect(page.getByRole('tree', { name: 'Entities' })).toBeVisible();
  } finally {
    writeFileSync(MAIN, original);
    await resetLayout(page).catch(() => undefined);
    await page.waitForTimeout(1500);
  }
});

test('moves an entity by dragging it in the Game screen, and applies it to the code', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const original = readFileSync(MAIN, 'utf8');
  try {
    await page.goto('/load?path=game');
    await page.waitForURL(/\/project\//);
    await resetLayout(page);
    await toolbar(page, 'Play').click();
    await expect(toolbar(page, 'Pause')).toBeVisible({ timeout: 30_000 });
    await showPanel(page, 'Hierarchy');
    await expect(liveEntity(page, 'terrainLine')).toBeVisible({ timeout: 15_000 });
    await toolbar(page, 'Pause').click();
    await expect(toolbar(page, 'Resume')).toBeVisible();

    const move = page.getByRole('button', { name: 'Move entities' });
    await expect(page.getByRole('application', { name: 'Move entities in the game' })).toHaveCount(
      0,
    );
    await move.click();
    const overlay = page.getByRole('application', { name: 'Move entities in the game' });
    const line = overlay.getByRole('button', { name: 'Move terrainLine' });
    await expect(line).toBeVisible({ timeout: 10_000 });
    const frame = (await page.getByRole('application', { name: 'Running game' }).boundingBox())!;
    const box = (await line.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - (frame.x + frame.width / 2))).toBeLessThan(4);

    const scale = frame.width / 1920;
    const grab = { x: box.x + box.width / 2, y: box.y + box.height * 0.2 };
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(grab.x - 100 * scale, grab.y, { steps: 5 });
    await page.mouse.up();
    await expect(liveEntity(page, 'terrainLine')).toContainText('changed');
    await showPanel(page, 'Inspector');
    const x = page
      .getByRole('region', { name: 'Position' })
      .getByRole('textbox', { name: 'x', exact: true });
    await expect.poll(async () => Number(await x.inputValue())).toBeLessThan(870);
    expect(Number(await x.inputValue())).toBeGreaterThan(840);
    expect(readFileSync(MAIN, 'utf8')).toBe(original);
    await page.getByRole('button', { name: 'Apply to code' }).click();
    await expect.poll(() => readFileSync(MAIN, 'utf8')).toMatch(/new Position\(8[4-6]\d, 0\)/);

    await move.click();
    await expect(overlay).toHaveCount(0);
    await toolbar(page, 'Stop').click();
    await expect(toolbar(page, 'Play')).toBeVisible({ timeout: 15_000 });
  } finally {
    writeFileSync(MAIN, original);
    await toolbar(page, 'Stop')
      .click({ timeout: 2000 })
      .catch(() => undefined);
    await resetLayout(page).catch(() => undefined);
    await page.waitForTimeout(1500);
  }
});

test('edits an engine enum param with a select (types from the engine packages)', async ({
  page,
}) => {
  const original = readFileSync(MAIN, 'utf8');
  try {
    await page.goto('/load?path=game');
    await page.waitForURL(/\/project\//);
    await resetLayout(page);
    await showPanel(page, 'Hierarchy');
    await page
      .getByRole('tree', { name: 'Entities' })
      .getByRole('treeitem', { name: /^me\b/ })
      .click();
    await showPanel(page, 'Inspector');
    const controller = page.getByRole('region', { name: 'Controller' });
    const up = controller.getByRole('button', { name: 'up', exact: true });
    await expect(up).toContainText('ArrowUp', { timeout: 15_000 });
    await up.click();
    await page.getByRole('option', { name: 'KeyW', exact: true }).click();
    await expect
      .poll(() => readFileSync(MAIN, 'utf8'))
      .toContain('new Controller(InputEnum.KeyW, InputEnum.ArrowDown)');
  } finally {
    writeFileSync(MAIN, original);
    await resetLayout(page).catch(() => undefined);
    await page.waitForTimeout(1500);
  }
});
