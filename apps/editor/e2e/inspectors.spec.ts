import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { resetLayout, showPanel } from './helpers';
import { type Page, expect, test } from './test';
import { GAME } from './workspace';

const open = async (page: Page, project: string) => {
  await page.goto(`/load?path=${project}`);
  await page.waitForURL(/\/project\//);
  await expect(page.getByRole('tab', { name: 'Files' })).toBeVisible();
  await resetLayout(page);
};
const tab = (page: Page, name: string) => page.getByRole('tab', { name });
const run = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Run' }).getByRole('button', { name, exact: false });
const play = async (page: Page) => {
  await run(page, 'Play').click();
  await expect(run(page, 'Pause')).toBeVisible({ timeout: 30_000 });
};
const stop = async (page: Page) => {
  await run(page, 'Stop').click();
  await expect(run(page, 'Play')).toBeVisible({ timeout: 15_000 });
};
/** The shown tab is saved with the layout: put Console back. */
const leave = async (page: Page) => {
  await showPanel(page, 'Console');
  await page.waitForTimeout(900);
};

test.afterEach(async ({ page }) => {
  const stopButton = run(page, 'Stop');
  if (await stopButton.isVisible().catch(() => false)) {
    await stopButton.click();
    await expect(run(page, 'Play')).toBeVisible({ timeout: 15_000 });
  }
});

test('inspectors say so when no game runs', async ({ page }) => {
  await open(page, 'pong');
  await expect(tab(page, 'Console')).toHaveAttribute('aria-selected', 'true');
  await showPanel(page, 'Profiler');
  await expect(page.getByText('Play the game: tick times, libraries and systems')).toBeVisible();
  await showPanel(page, 'Network');
  await expect(page.getByText('No packets yet')).toBeVisible();
  await showPanel(page, 'World');
  await expect(page.getByText('Play the game: its entities and their components')).toBeVisible();
  await leave(page);
});

test.describe('with the engine', () => {
  test.skip(!existsSync(join(GAME, 'package.json')), 'needs a built engine (NANOFORGE_ENGINE)');

  test('profiler: tick windows, libraries, systems, and a pinned window', async ({ page }) => {
    test.setTimeout(120_000);
    await open(page, 'game');
    await showPanel(page, 'Profiler');
    await play(page);

    await expect(page.getByRole('img', { name: 'Tick time' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Ticks per second' })).toBeVisible();
    await expect(page.getByText(/\d+ ticks\/s/)).toBeVisible();
    await expect(page.getByText(/spikes? over 16\.7 ms/)).toBeVisible();
    const libraries = page.getByRole('table', { name: 'Libraries' });
    await expect(libraries.getByRole('rowheader', { name: 'ecs', exact: true })).toBeVisible();
    const systems = page.getByRole('table', { name: 'Systems' });
    await expect(systems.getByRole('rowheader').first()).toBeVisible();
    await expect(systems.getByText("doesn't report system timings")).toHaveCount(0);
    await expect(systems.getByRole('row').nth(1)).toContainText(/\d ms/);

    await page.getByRole('group', { name: 'Game' }).getByRole('button', { name: 'Server' }).click();
    await expect(page.getByRole('img', { name: 'Tick time' })).toBeVisible();
    await page.getByRole('group', { name: 'Game' }).getByRole('button', { name: 'Client' }).click();

    const chart = page.getByRole('slider', { name: 'Tick time: pick a window' });
    await expect
      .poll(async () => Number(await chart.getAttribute('aria-valuemax')), { timeout: 15_000 })
      .toBeGreaterThan(8);
    const box = (await chart.boundingBox())!;
    await page.mouse.click(box.x + box.width - 3, box.y + box.height / 2);
    await expect(page.getByRole('status').filter({ hasText: /Paused, window of/ })).toBeVisible();
    const pinned = await libraries.locator('caption').textContent();
    await page.waitForTimeout(800);
    expect(await libraries.locator('caption').textContent()).toBe(pinned);
    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true }).last()).toBeVisible();

    await stop(page);
    await expect(page.getByRole('img', { name: 'Tick time' })).toBeVisible();
    await leave(page);
  });

  test('network: packets, filters, a decoded payload and its bytes', async ({ page }) => {
    test.setTimeout(120_000);
    await open(page, 'game');
    await showPanel(page, 'Network');
    await play(page);

    const packets = page.getByRole('table', { name: 'Packets' }).locator('tbody tr');
    await expect(packets.first()).toBeVisible({ timeout: 15_000 });

    const count = page.getByRole('status').filter({ hasText: /of \d+ packets/ });
    await showPanel(page, 'Console');
    await page.waitForTimeout(1500);
    await showPanel(page, 'Network');
    const before = await count.textContent();
    await showPanel(page, 'Console');
    await page.waitForTimeout(2500);
    await showPanel(page, 'Network');
    expect(await count.textContent()).toBe(before);
    await expect(page.getByRole('img', { name: 'Bytes per second' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('img', { name: 'Packets per second' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Search payloads' }).fill('"type":"assignId"');
    const direction = page.getByRole('group', { name: 'Direction' });
    await direction.getByRole('button', { name: 'In', exact: true }).click();
    await page
      .getByRole('group', { name: 'Transport' })
      .getByRole('button', { name: 'TCP' })
      .click();
    await expect(packets.first()).toContainText('← in');
    await expect(packets.first()).toContainText('TCP');
    await packets.first().click();
    const detail = page.getByRole('complementary', { name: 'Packet detail' });
    await expect(detail.getByText('Decoded (JSON)')).toBeVisible();
    await expect(detail.getByLabel('Decoded payload')).toContainText('"type": "assignId"');
    await expect(detail.getByRole('group', { name: 'Payload bytes' })).toContainText(
      '7b 22 74 79 70 65',
    );
    await direction.getByRole('button', { name: 'Out' }).click();
    await expect(packets).toHaveCount(0);
    await expect(
      page.getByRole('status').filter({ hasText: /^\s*0 of \d+ packets/ }),
    ).toBeVisible();

    await stop(page);
    await leave(page);
  });

  test('world: the running entities, narrowed by a query', async ({ page }) => {
    test.setTimeout(120_000);
    await open(page, 'game');
    await showPanel(page, 'World');
    await play(page);

    const entities = page
      .getByRole('list', { name: 'Entities of the running world' })
      .getByRole('listitem');
    await expect(entities.first()).toBeVisible({ timeout: 15_000 });
    const all = await entities.count();
    expect(all).toBeGreaterThan(1);
    const query = page.getByRole('textbox', { name: 'World query' });

    await query.fill('Controller');
    await expect.poll(() => entities.count()).toBeLessThan(all);
    await expect(entities.first()).toContainText('Controller');
    await expect(page.getByRole('status').filter({ hasText: /\d+ of \d+\s+entit/ })).toBeVisible();

    await query.fill('Position.x > 100000');
    await expect(page.getByText('No entity matches the query.')).toBeVisible();
    await query.fill('');
    const first = entities.first();
    const id = (await first.getAttribute('aria-label'))!.replace('Entity ', '');
    await query.fill(`#${id}`);
    await expect(entities).toHaveCount(1);
    await first.getByRole('button').first().click();
    await expect(first.getByRole('button', { expanded: false }).first()).toBeVisible();

    await stop(page);
    await leave(page);
  });
});
