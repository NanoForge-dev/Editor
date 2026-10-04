import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { resetLayout, showPanel } from './helpers';
import { type Page, expect, test } from './test';
import { BREAKOUT } from './workspace';

const hasBreakout = existsSync(join(BREAKOUT, 'package.json'));
const LEVELS = join(BREAKOUT, 'apps/client/src/scenes/levels.ts');
const MAIN = join(BREAKOUT, 'apps/client/src/main.ts');
const SCENES = join(BREAKOUT, 'apps/client/src/scenes');
const levels = () => readFileSync(LEVELS, 'utf8');
const main = () => readFileSync(MAIN, 'utf8');
const sceneFile = (name: string) => () =>
  existsSync(join(SCENES, name)) ? readFileSync(join(SCENES, name), 'utf8') : undefined;
const SRC = join(BREAKOUT, 'apps/client/src');
const VARS = join(SRC, 'scene-vars.ts');
const vars = () => readFileSync(VARS, 'utf8');
/** Every file of the client's sources, to put back after each test. */
const snapshot = (dir = SRC): Map<string, string> =>
  new Map(
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory()
        ? [...snapshot(path)]
        : [[path, readFileSync(path, 'utf8')] as const];
    }),
  );
let original = new Map<string, string>();

const scenes = (page: Page) => page.getByRole('tree', { name: 'Scenes' });
const scene = (page: Page, name: string) =>
  scenes(page).getByRole('treeitem', { name: new RegExp(`^${name}\\b`) });
const entities = (page: Page) => page.getByRole('tree', { name: 'Entities' });
const inherited = (page: Page) => page.getByRole('tree', { name: 'Inherited entities' });

test.describe('scenes', () => {
  test.skip(!hasBreakout, 'needs an engine with the scene module (NANOFORGE_ENGINE)');

  test.beforeEach(async ({ page }) => {
    original = snapshot();
    await page.goto('/load?path=breakout');
    await page.waitForURL(/\/project\//);
    await resetLayout(page);
  });

  test.afterEach(async ({ page }) => {
    for (const path of snapshot().keys()) if (!original.has(path)) rmSync(path);
    for (const [path, text] of original) writeFileSync(path, text);
    await resetLayout(page);
    await page.waitForTimeout(1500);
  });

  test('shows the scene tree, and the ECS widgets edit the selected scene', async ({ page }) => {
    await showPanel(page, 'Scenes');
    await expect(scene(page, 'Menu')).toBeVisible();
    await expect(scene(page, 'Run')).toHaveAttribute('aria-expanded', 'true');
    await expect(scene(page, 'Level2')).toBeVisible();
    await expect(scene(page, 'Menu')).toContainText('initial');

    await expect(scene(page, 'main.ts')).toHaveAttribute('aria-selected', 'true');
    await showPanel(page, 'Hierarchy');
    await page.getByRole('button', { name: 'Add entity' }).click();
    await expect.poll(main).toContain('const entity = registry.spawnEntity();');
    await entities(page)
      .getByRole('treeitem', { name: /^entity\b/ })
      .click();
    await page.keyboard.press('Control+z');
    await expect.poll(main).not.toContain('const entity = registry.spawnEntity();');

    await showPanel(page, 'Scenes');
    await scene(page, 'Level1').click();
    await showPanel(page, 'Hierarchy');
    await expect(entities(page).getByRole('treeitem', { name: /^brick1\b/ })).toBeVisible();
    await expect(inherited(page).getByRole('treeitem', { name: /^Run\b/ })).toBeVisible();
    await expect(inherited(page).getByRole('treeitem', { name: /^paddle\b/ })).toBeVisible();

    await page.getByRole('button', { name: 'Add entity' }).click();
    await expect
      .poll(levels)
      .toMatch(/class Level1[\s\S]*const entity = registry\.spawnEntity\(\);[\s\S]*class Level2/);
    await page.getByRole('textbox', { name: 'Filter entities' }).fill('entity');
    await entities(page)
      .getByRole('treeitem', { name: /^entity\b/ })
      .click();
    await page.keyboard.press('Control+z');
    await expect.poll(levels).not.toContain('const entity = registry.spawnEntity();');

    await page.getByRole('textbox', { name: 'Filter entities' }).fill('brick1');
    await entities(page)
      .getByRole('treeitem', { name: /^brick1\b/ })
      .click();
    await showPanel(page, 'Components');
    const components = page.getByRole('region', { name: 'Components', exact: true });
    await components.getByRole('button', { name: /^C Velocity\b/ }).click();
    await page.getByRole('button', { name: 'Add to brick1' }).click();
    await expect
      .poll(levels)
      .toMatch(
        /class Level1[\s\S]*registry\.addComponent\(brick1, new Velocity\([^)]*\)\);[\s\S]*class Level2/,
      );
    await components.getByRole('button', { name: /^S pauseMenu\b/ }).click();
    await page.getByRole('button', { name: 'Add to scene' }).click();
    await expect
      .poll(levels)
      .toMatch(/class Level1[\s\S]*registry\.addSystem\(pauseMenu\);[\s\S]*class Level2/);
    expect(levels()).toMatch(
      /import \{ Pause, pauseMenu \} from "\.\/pause";|import \{ pauseMenu \} from "\.\/pause";/,
    );
  });

  test('lists the systems of the scene, with its parents above', async ({ page }) => {
    await showPanel(page, 'Scenes');
    await scene(page, 'Level2').click();
    await showPanel(page, 'Systems');
    const parents = page.getByRole('list', { name: 'Systems of the parent scenes' });
    await expect(parents.getByRole('listitem')).toHaveCount(5);
    await expect(parents.getByRole('listitem').first()).toContainText('drawVisuals');
    await expect(parents).toContainText('movePaddle');
    await expect(page.getByRole('tree', { name: 'Systems in run order' })).toContainText(
      'levelFlow',
    );
  });

  test('creates, renames, moves, sets as initial and deletes a scene, with undo', async ({
    page,
  }) => {
    await showPanel(page, 'Scenes');
    await scene(page, 'Run').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'New scene under Run…' }).click();
    const name = page.getByRole('textbox', { name: 'Name' });
    await name.fill('Bonus');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect.poll(sceneFile('bonus.ts')).toContain('export class Bonus extends EcsScene {');
    expect(sceneFile('bonus.ts')()).toContain('static override parent = Run;');
    await expect.poll(main).toContain('Pause, GameOver, Victory, Bonus }');
    await expect(scene(page, 'Bonus')).toBeVisible();
    await expect(page.getByRole('tab', { name: /^bonus\.ts/ })).toBeVisible();
    await expect(page.locator('.monaco-editor').first()).toBeVisible();

    await showPanel(page, 'Scenes');
    await scene(page, 'Bonus').click();
    await page.keyboard.press('F2');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Extra');
    await page.keyboard.press('Enter');
    await expect.poll(sceneFile('extra.ts')).toContain('export class Extra extends EcsScene {');
    await expect.poll(main).toContain('import { Extra } from "./scenes/extra";');
    expect(main()).toContain('Victory, Extra }');
    expect(sceneFile('bonus.ts')()).toBeUndefined();

    await scene(page, 'Pause').dragTo(scene(page, 'Run'));
    await expect.poll(sceneFile('pause.ts')).toContain('static override parent = Run;');
    await scenes(page).focus();
    await page.keyboard.press('Control+z');
    await expect.poll(sceneFile('pause.ts')).not.toContain('static override parent');

    await scene(page, 'Extra').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Move to the root' }).click();
    await expect.poll(sceneFile('extra.ts')).not.toContain('static override parent');
    await scene(page, 'Extra').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Set as initial scene' }).click();
    await expect.poll(main).toContain('initial: Extra,');
    await expect(scene(page, 'Extra')).toContainText('initial');
    await scene(page, 'Extra').click();
    await page.keyboard.press('Control+z');
    await expect.poll(main).toContain('initial: Menu,');
    await expect(scene(page, 'Extra')).not.toContainText('initial');

    await scene(page, 'Extra').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect.poll(sceneFile('extra.ts')).toBeUndefined();
    await expect.poll(main).not.toContain('Extra');
    await scenes(page).focus();
    await page.keyboard.press('Control+z');
    await expect.poll(sceneFile('extra.ts')).toContain('export class Extra');
    await expect.poll(main).toContain('Victory, Extra }');
  });

  test('declares, renames and removes scene vars, and lists their uses', async ({ page }) => {
    await showPanel(page, 'Vars');
    const list = page.getByRole('list', { name: 'Scene vars' });
    const lives = list.getByRole('listitem', { name: 'lives', exact: true });
    await expect(lives).toContainText('made by Run');
    await lives.getByRole('button').first().click();
    await expect(page.getByRole('list', { name: 'Uses of lives' })).toContainText('lose-ball.ts');

    await page.getByRole('button', { name: 'Add var' }).click();
    const field = page.getByRole('dialog').getByRole('textbox');
    await field.fill('combo');
    await page.getByRole('button', { name: 'Next' }).click();
    await field.fill('number');
    await page.getByRole('button', { name: 'Next' }).click();
    await field.fill('0');
    await page.getByRole('button', { name: 'Next' }).click();
    await field.fill('Bricks broken in a row.');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect.poll(vars).toContain('/** Bricks broken in a row. @default 0 */');
    await expect(list.getByRole('listitem', { name: 'combo', exact: true })).toContainText(
      'unused',
    );

    await lives.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Rename…' }).click();
    await field.fill('balls');
    await page.getByRole('button', { name: 'Rename' }).click();
    await expect.poll(vars).toContain('balls: number;');
    await expect
      .poll(() => readFileSync(join(SRC, 'systems/lose-ball.ts'), 'utf8'))
      .toContain('vars.get("balls")');
    await expect
      .poll(() => readFileSync(join(SCENES, 'run.ts'), 'utf8'))
      .toContain('vars.init("balls", 3)');

    await list.getByRole('listitem', { name: 'balls', exact: true }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Remove' }).click();
    await expect.poll(vars).not.toContain('balls');
    const undeclared = page.getByRole('list', { name: 'Undeclared vars' });
    await expect(undeclared.getByRole('listitem', { name: 'balls', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Declare balls' }).click();
    await expect(field).toHaveValue('number');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Declare' }).click();
    await expect.poll(vars).toContain('balls: number;');
  });

  test.describe('while playing', () => {
    const run = (page: Page, name: string) =>
      page.getByRole('toolbar', { name: 'Run' }).getByRole('button', { name });

    test.afterEach(async ({ page }) => {
      if (await run(page, 'Stop').isVisible()) {
        await run(page, 'Stop').click();
        await expect(run(page, 'Play')).toBeVisible({ timeout: 15_000 });
      }
    });

    test('shows the loaded scenes and vars, loads a scene and sets a var', async ({ page }) => {
      await run(page, 'Play').click();
      await expect(page.locator('[data-nf-game] canvas').first()).toBeVisible({ timeout: 60_000 });

      await showPanel(page, 'Scenes');
      await expect(scene(page, 'Menu')).toContainText('current', { timeout: 15_000 });

      await scene(page, 'Level2').click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Load scene', exact: true }).click();
      await expect(scene(page, 'Level2')).toContainText('current', { timeout: 10_000 });
      await expect(scene(page, 'Run')).toContainText('loaded');
      await expect(scene(page, 'Menu')).not.toContainText('loaded');

      await showPanel(page, 'Vars');
      await expect(page.getByLabel('Live value of lives')).toContainText('3');
      await expect(page.getByLabel('Live value of lives')).toContainText('of Run');
      await expect(page.getByLabel('Live value of bricksLeft')).toContainText('of Level2');
      const list = page.getByRole('list', { name: 'Scene vars' });
      await list.getByRole('listitem', { name: 'lives', exact: true }).click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Set live value…' }).click();
      await page.getByRole('dialog').getByRole('textbox').fill('7');
      await page.getByRole('button', { name: 'Set', exact: true }).click();
      await expect(page.getByLabel('Live value of lives')).toContainText('7');

      await showPanel(page, 'Hierarchy');
      const liveTree = page.getByRole('tree', { name: 'Live entities' });
      await expect(liveTree.getByRole('treeitem', { name: /^Run\b/ })).toBeVisible();
      await expect(liveTree.getByRole('treeitem', { name: /^Level2\b/ })).toBeVisible();
      await expect(liveTree.getByRole('treeitem', { name: /^paddle\b/ })).toBeVisible();

      await liveTree.getByRole('treeitem', { name: /^brick1\b/ }).click();
      await showPanel(page, 'Inspector');
      const x = page
        .getByRole('region', { name: 'Position' })
        .getByRole('textbox', { name: 'x', exact: true });
      await x.fill('100');
      await x.press('Enter');
      await page.getByRole('button', { name: 'Apply to code' }).click();
      await expect
        .poll(levels)
        .toMatch(
          /class Level2[\s\S]*registry\.addComponent\(brick1, new Position\(100, \d+\)\);[\s\S]*class Level3/,
        );
      expect(levels()).not.toMatch(/class Level1[\s\S]*new Position\(100,[\s\S]*class Level2/);
    });
  });
});
