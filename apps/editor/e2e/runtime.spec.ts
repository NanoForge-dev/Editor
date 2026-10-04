import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { type Page, expect, test } from './test';
import { GAME } from './workspace';

test.skip(!existsSync(join(GAME, 'package.json')), 'needs a built engine (NANOFORGE_ENGINE)');

const toolbar = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Run' }).getByRole('button', { name, exact: false });

test('plays pong-network server and client, pauses, resumes and stops, three times', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await page.getByLabel('Project folder').fill('game');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.waitForURL(/\/project\//);
  const output = page.getByRole('log', { name: 'Console' });
  await page.getByRole('button', { name: /^Editor/ }).click();

  for (let run = 1; run <= 3; run++) {
    await page.getByRole('button', { name: 'Clear console' }).click();
    await toolbar(page, 'Play').click();
    await expect(page.getByRole('tab', { name: 'Game' })).toHaveAttribute('aria-selected', 'true');
    await expect(toolbar(page, 'Pause')).toBeVisible({ timeout: 30_000 });

    const canvas = page.locator('[data-nf-game] canvas').first();
    await expect(canvas).toBeVisible();
    const box = (await canvas.boundingBox())!;
    expect(box.width).toBeGreaterThan(100);
    await expect(
      output.locator('[data-source="game:server"]').filter({ hasText: 'Starting server' }),
    ).toHaveCount(1);
    await expect(page.locator('[data-nf-game]')).toHaveCount(1);
    await expect(page.getByText(/client \d+ tps · [\d.]+ ms/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/server \d+ tps · [\d.]+ ms/)).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'engine' })).toHaveCount(0);
    const client = output.locator('[data-source="game:client"]');
    await expect(client.filter({ hasText: 'pong client ready' })).toHaveCount(1);
    await expect(client.filter({ hasText: /plugin|runtime/i })).toHaveCount(0);
    await expect(output.locator('[data-group="build"]').first()).toBeVisible();

    await toolbar(page, 'Pause').click();
    await expect(page.getByRole('status').filter({ hasText: 'Paused' })).toBeVisible();
    await toolbar(page, 'Step one frame').click();
    await toolbar(page, 'Resume').click();
    await expect(toolbar(page, 'Pause')).toBeVisible();

    await toolbar(page, 'Stop').click();
    await expect(toolbar(page, 'Play')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-nf-game]')).toHaveCount(0);
  }
  await expect(output.getByText('did not stop')).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: /^Editor/ }).click();
  await page.waitForTimeout(900);
});

test('offers to add the editor library to a game that does not register it', async ({ page }) => {
  test.setTimeout(120_000);
  const files = ['apps/server/src/main.ts', 'apps/server/package.json'].map((file) =>
    join(GAME, file),
  );
  const saved = files.map((file) => readFileSync(file, 'utf8'));
  writeFileSync(
    files[0]!,
    saved[0]!
      .replace('import { EditorLibrary } from "@nanoforge-dev/editor-lib";\n', '')
      .replace(/\n[ \t]*app\.use\(new EditorLibrary\(\)\);/, ''),
  );
  expect(readFileSync(files[0]!, 'utf8')).not.toContain('EditorLibrary');
  try {
    await page.goto('/load?path=game');
    await page.waitForURL(/\/project\//);
    await toolbar(page, 'Play').click();
    const warning = page
      .getByRole('region', { name: 'Notifications' })
      .getByText('The game has no editor bridge');
    await expect(warning).toBeVisible({ timeout: 30_000 });
    await expect(toolbar(page, 'Pause')).toHaveCount(0);
    await page.getByRole('button', { name: 'Add the editor library' }).click();
    await expect
      .poll(() => readFileSync(files[0]!, 'utf8'))
      .toContain('import { EditorLibrary } from "@nanoforge-dev/editor-lib";');
    expect(readFileSync(files[0]!, 'utf8')).toMatch(
      /app\.use\(\w+\);\n\s*app\.use\(new EditorLibrary\(\)\);/,
    );
    expect(readFileSync(files[1]!, 'utf8')).toContain('"@nanoforge-dev/editor-lib"');
    await toolbar(page, 'Stop').click();
    await expect(toolbar(page, 'Play')).toBeVisible({ timeout: 15_000 });

    await toolbar(page, 'Play').click();
    await expect(toolbar(page, 'Pause')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/server \d+ tps · [\d.]+ ms/)).toBeVisible({ timeout: 5000 });
    await toolbar(page, 'Stop').click();
    await expect(toolbar(page, 'Play')).toBeVisible({ timeout: 15_000 });
  } finally {
    files.forEach((file, index) => writeFileSync(file, saved[index]!));
  }
});
