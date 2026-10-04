import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { resetLayout, showPanel } from './helpers';
import { type Page, expect, test } from './test';
import { GAME, PONG } from './workspace';

const BROKEN = join(PONG, 'scratch/broken.ts');

const log = (page: Page) => page.getByRole('log', { name: 'Console' });
const lines = (page: Page, source: string) => log(page).locator(`[data-source="${source}"]`);
const chip = (page: Page, group: string) =>
  page
    .getByRole('group', { name: 'Source groups' })
    .getByRole('button', { name: new RegExp(`^${group}`) });
const level = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Levels' }).getByRole('button', { name });

const open = async (page: Page, project = 'pong') => {
  await page.goto(`/load?path=${project}`);
  await page.waitForURL(/\/project\//);
  await expect(page.getByRole('tab', { name: 'Files' })).toBeVisible();
  await resetLayout(page);
};

const logHello = async (page: Page) => {
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Log hello' }).click();
};

test.afterEach(() => rmSync(BROKEN, { force: true }));

test('console: groups, levels, search, repeats, values and file links', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('tab', { name: 'Console' })).toHaveAttribute('aria-selected', 'true');
  const hello = lines(page, '@acme/hello');

  await logHello(page);
  await expect(hello).toHaveCount(0);
  await expect(chip(page, 'Plugins')).toContainText('hidden warnings or errors');
  await chip(page, 'Plugins').click();
  await expect(chip(page, 'Plugins')).toHaveAttribute('aria-pressed', 'true');
  await expect(hello.filter({ hasText: 'Hello state' })).toHaveCount(1);
  await expect(hello.filter({ hasText: 'Careful with greetings' })).toHaveCount(1);
  await expect(hello.filter({ hasText: 'A quiet detail' })).toHaveCount(0);
  await level(page, 'Debug').click();
  await expect(hello.filter({ hasText: 'A quiet detail' })).toHaveCount(1);
  await level(page, 'Debug').click();

  const tick = hello.filter({ hasText: 'tick' });
  await expect(tick).toHaveCount(1);
  await expect(tick).toContainText(/Repeated\s*3\s*times/);

  const state = hello.filter({ hasText: 'Hello state' });
  await expect(state).toContainText('{ greetings: 0, nested: { deep: true, list: [1, 2] } }');
  await state.getByRole('button', { name: 'Expand value' }).click();
  await state.getByRole('button', { name: 'Expand nested' }).click();
  await expect(state.getByRole('button', { name: 'Expand list' })).toBeVisible();
  await expect(state).toContainText('deep: true');
  await state.getByRole('button', { name: 'Collapse value' }).click();
  await expect(state.getByRole('button', { name: 'Expand list' })).toHaveCount(0);

  await level(page, 'Info').click();
  await expect(hello).toHaveCount(1);
  await expect(hello).toContainText('Careful with greetings');
  await level(page, 'Info').click();
  await page.getByLabel('Search console').fill('STATE');
  await expect(hello).toHaveCount(1);
  await expect(hello).toContainText('Hello state');
  await page.getByLabel('Search console').fill('');

  await page.getByRole('button', { name: 'Sources' }).click();
  await page.getByRole('menuitem', { name: 'Plugins' }).click();
  await page.getByRole('menuitem', { name: '@acme/hello' }).click();
  await expect(hello).toHaveCount(0);
  await page.getByRole('button', { name: 'Sources' }).click();
  await page.getByRole('menuitem', { name: 'Show every source' }).click();
  await expect(hello.filter({ hasText: 'Hello state' })).toHaveCount(1);

  await hello.getByRole('button', { name: 'apps/client/src/main.ts:3:1' }).click();
  await expect(page.getByRole('tab', { name: 'main.ts' })).toBeVisible();
  await expect(page.locator('.monaco-editor .active-line-number')).toHaveText('3');

  await page.getByRole('button', { name: 'Clear console' }).click();
  await expect(log(page).locator('[data-line]')).toHaveCount(0);
  await expect(page.getByText('Nothing logged yet')).toBeVisible();
  await chip(page, 'Plugins').click();
  await expect(chip(page, 'Plugins')).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('tab', { name: 'main.ts' }).click({ button: 'middle' });
  await page.waitForTimeout(900);
});

test('problems: a file that is not open, grouped by file, opens at its position', async ({
  page,
}) => {
  writeFileSync(BROKEN, 'export const fine = 1;\nexport const count: number = "three";\n');
  await open(page);

  const status = page.getByRole('button', { name: /\d+ errors?/ });
  await expect(status).toBeVisible({ timeout: 30_000 });
  await status.click();
  await expect(page.getByRole('tab', { name: 'Problems' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  const file = page
    .getByRole('list', { name: 'Problems' })
    .getByRole('listitem', { name: 'scratch/broken.ts' });
  const problem = file.getByRole('button', { name: /is not assignable to type 'number'/ });
  await expect(problem).toContainText('typescript 2322');
  await expect(problem).toContainText('2:14');
  await expect(file.getByRole('button', { name: /scratch\/broken\.ts/ })).toContainText('1 error');

  await file.getByRole('button', { name: /scratch\/broken\.ts/ }).click();
  await expect(problem).toHaveCount(0);
  await file.getByRole('button', { name: /scratch\/broken\.ts/ }).click();

  await page.getByLabel('Search problems').fill("assignable to type 'number'");
  await expect(page.getByRole('list', { name: 'Problems' }).getByRole('listitem')).toHaveCount(1);
  await page
    .getByRole('group', { name: 'Severities' })
    .getByRole('button', { name: 'Errors' })
    .click();
  await expect(page.getByText('No problems match the filters')).toBeVisible();
  await page
    .getByRole('group', { name: 'Severities' })
    .getByRole('button', { name: 'Errors' })
    .click();
  await page.getByLabel('Search problems').fill('');

  await problem.click();
  await expect(page.getByRole('tab', { name: 'broken.ts' })).toBeVisible();
  await expect(page.locator('.monaco-editor .active-line-number')).toHaveText('2');

  await page.getByRole('tab', { name: 'broken.ts' }).click({ button: 'middle' });
  rmSync(BROKEN);
  await expect(file).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(900);
});

test.describe('with the engine', () => {
  const MAIN = join(GAME, 'apps/client/src/main.ts');
  test.skip(!existsSync(join(GAME, 'package.json')), 'needs a built engine (NANOFORGE_ENGINE)');

  test('problems: a build error is listed with its file and position, until the app builds again', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const original = readFileSync(MAIN, 'utf8');
    const errorLine = original.split('\n').length;
    try {
      await open(page, 'game');
      await showPanel(page, 'Problems');
      writeFileSync(MAIN, `${original}const = ;\n`);
      const file = page
        .getByRole('list', { name: 'Problems' })
        .getByRole('listitem', { name: 'apps/client/src/main.ts' });
      const build = file.getByRole('button').filter({ hasText: /\bbuild\b/ });
      await expect(build.first()).toBeVisible({ timeout: 30_000 });
      await expect(build.first()).toContainText(new RegExp(`${errorLine}:\\d+$`));
      await showPanel(page, 'Console');
      await expect(
        log(page)
          .locator('[data-group="build"]')
          .getByRole('button', { name: new RegExp(`main\\.ts:${errorLine}:\\d+`) })
          .first(),
      ).toBeVisible();

      writeFileSync(MAIN, original);
      await showPanel(page, 'Problems');
      await expect(build).toHaveCount(0, { timeout: 30_000 });
      await showPanel(page, 'Console');
      await page.waitForTimeout(900);
    } finally {
      writeFileSync(MAIN, original);
    }
  });

  test('game output: values of the client expand, and lines link to where they were logged', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const original = readFileSync(MAIN, 'utf8');
    const ready = 'console.log("pong client ready");';
    expect(original).toContain(ready);
    writeFileSync(
      MAIN,
      original.replace(ready, `${ready}\n  console.warn("score", { left: 1, right: [2, 3] });`),
    );
    const loggedAt = original.slice(0, original.indexOf(ready)).split('\n').length + 1;
    const run = page.getByRole('toolbar', { name: 'Run' });
    try {
      await open(page, 'game');
      await run.getByRole('button', { name: 'Play' }).click();
      await expect(run.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 30_000 });

      const score = lines(page, 'game:client').filter({ hasText: 'score' });
      await expect(score).toHaveCount(1);
      await expect(score).toHaveClass(/warn/);
      await score.getByRole('button', { name: 'Expand value' }).click();
      await expect(score).toContainText('left: 1');
      await score.getByRole('button', { name: 'Expand right' }).click();
      await expect(score).toContainText('1: 3');
      await expect(lines(page, 'game:server').first()).toBeVisible();

      if (process.env.NANOFORGE_CLI) {
        const where = score.getByRole('button', { name: `main.ts:${loggedAt}` });
        await expect(where).toBeVisible();
        await run.getByRole('button', { name: 'Stop' }).click();
        await expect(run.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 15_000 });
        await where.click();
        await expect(page.getByRole('tab', { name: 'main.ts' })).toBeVisible();
        await expect(page.locator('.monaco-editor .active-line-number')).toHaveText(
          String(loggedAt),
        );
        await page.getByRole('tab', { name: 'main.ts' }).click({ button: 'middle' });
      } else {
        await run.getByRole('button', { name: 'Stop' }).click();
        await expect(run.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 15_000 });
      }
      await page.waitForTimeout(900);
    } finally {
      writeFileSync(MAIN, original);
    }
  });
});
