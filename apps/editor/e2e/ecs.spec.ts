import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expandFolders, resetLayout, showPanel } from './helpers';
import { type Page, expect, test } from './test';
import { PONG } from './workspace';

const MAIN = join(PONG, 'apps/client/src/main.ts');
let original: string;

const entities = (page: Page) => page.getByRole('tree', { name: 'Entities' });
const entity = (page: Page, name: string) =>
  entities(page).getByRole('treeitem', { name: new RegExp(`^${name}\\b`) });
const main = () => readFileSync(MAIN, 'utf8');

test.beforeEach(async ({ page }) => {
  original = readFileSync(MAIN, 'utf8');
  await page.goto('/load?path=pong');
  await page.waitForURL(/\/project\//);
  await resetLayout(page);
  await showPanel(page, 'Hierarchy');
});

test.afterEach(async ({ page }) => {
  writeFileSync(MAIN, original);
  await resetLayout(page);
  await page.waitForTimeout(1500);
});

test('lists the entities of main.ts and edits a component param', async ({ page }) => {
  await expect(entity(page, 'ball')).toBeVisible();
  await expect(entity(page, 'paddle2')).toBeVisible();
  const name = entity(page, 'paddle2').getByText('paddle2', { exact: true });
  expect(await name.evaluate((label) => label.scrollWidth <= label.clientWidth)).toBe(true);
  await entity(page, 'ball').click();

  await showPanel(page, 'Inspector');
  const inspector = page.getByRole('region', { name: 'Position' });
  await expect(inspector).toBeVisible();
  const x = inspector.getByRole('textbox', { name: 'x', exact: true });
  await x.fill('42');
  await x.press('Enter');
  await expect.poll(main).toContain('registry.addComponent(ball, new Position(42, 0));');

  await showPanel(page, 'Hierarchy');
  await entity(page, 'ball').click();
  await page.keyboard.press('Control+z');
  await expect.poll(main).toContain('registry.addComponent(ball, new Position(0, 0));');
});

test('adds, renames and removes an entity', async ({ page }) => {
  await page.getByRole('button', { name: 'Add entity' }).click();
  await expect.poll(main).toContain('const entity = registry.spawnEntity();');
  await expect(entity(page, 'entity')).toBeVisible();

  await entity(page, 'entity').click();
  await page.keyboard.press('F2');
  await page.keyboard.type('score');
  await page.keyboard.press('Enter');
  await expect.poll(main).toContain('const score = registry.spawnEntity();');

  await entity(page, 'score').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const field = entities(page).getByRole('textbox');
  await expect(field).toBeFocused();
  await field.fill('points');
  await field.press('Enter');
  await expect.poll(main).toContain('const points = registry.spawnEntity();');

  await entity(page, 'points').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  await expect.poll(main).not.toContain('const points');
});

test('edits the layout of a component from its code page', async ({ page }) => {
  const COMPONENTS = join(PONG, 'apps/client/src/components/components.ts');
  const before = readFileSync(COMPONENTS, 'utf8');
  try {
    await showPanel(page, 'Files');
    await expandFolders(page, 'apps', 'client', 'src', 'components');
    await page.getByRole('treeitem', { name: 'components.ts', exact: true }).dblclick();
    const panel = page.getByRole('complementary', { name: 'Component panel' });
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: 'Component to edit' }).click();
    await page.getByRole('option', { name: 'Position' }).click();

    await panel.getByRole('button', { name: 'New group' }).click();
    await expect(panel.getByRole('group', { name: 'Group Group 1' })).toBeVisible();
    for (const param of ['x', 'y']) {
      await panel.getByRole('button', { name: `Group of ${param}` }).click();
      await page.getByRole('option', { name: 'Group 1' }).click();
      await expect(panel.getByRole('button', { name: `Group of ${param}` })).toContainText(
        'Group 1',
      );
      await panel.getByRole('button', { name: `Preset of ${param}` }).click();
      await page.getByRole('option', { name: 'vector' }).click();
      await expect(panel.getByRole('button', { name: `Preset of ${param}` })).toContainText(
        'vector',
      );
    }
    await panel.getByRole('button', { name: 'Preset of y' }).focus();
    await page.keyboard.press('Control+z');
    await expect(panel.getByRole('button', { name: 'Preset of y' })).toContainText('None');
    await page.keyboard.press('Control+y');
    await expect(panel.getByRole('button', { name: 'Preset of y' })).toContainText('vector');

    await expect(
      panel
        .getByRole('region', { name: 'Preview' })
        .getByRole('group', { name: 'Group 1', exact: true }),
    ).toBeVisible();

    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.press('Control+s');
    await expect
      .poll(() => readFileSync(COMPONENTS, 'utf8'))
      .toContain('@group Group 1\n */\nexport class Position');
    const text = readFileSync(COMPONENTS, 'utf8');
    expect(text).toContain('/** @group Group 1 @preset vector.x */');
    expect(text).toContain('/** @group Group 1 @preset vector.y */');
  } finally {
    writeFileSync(COMPONENTS, before);
    await showPanel(page, 'Files');
    const apps = page
      .getByRole('tree', { name: 'Project files' })
      .getByRole('treeitem', { name: 'apps', exact: true });
    await apps.click();
    await page.keyboard.press('ArrowLeft');
    await expect(apps).toHaveAttribute('aria-expanded', 'false');
  }
});

test('creates a shared library, uses its component and moves an app component into it', async ({
  page,
}) => {
  const files = [
    'nanoforge.config.ts',
    'tsconfig.json',
    'apps/client/package.json',
    'apps/server/package.json',
    'apps/client/nanoforge.config.ts',
    'apps/server/nanoforge.config.ts',
  ].map((name) => join(PONG, name));
  const saved = files.map((file) => readFileSync(file, 'utf8'));
  const libs = join(PONG, 'libs');
  const health = join(PONG, 'apps/client/src/components/health.ts');
  const components = page.getByRole('region', { name: 'Components', exact: true });
  const prompt = async (label: string, value: string, confirm: string) => {
    const field = page.getByRole('dialog').getByRole('textbox', { name: label });
    await field.fill(value);
    await page.getByRole('dialog').getByRole('button', { name: confirm }).click();
  };
  try {
    await showPanel(page, 'Components');
    await components.getByRole('button', { name: 'New' }).click();
    await page.getByRole('menuitem', { name: 'New shared library…' }).click();
    await prompt('Folder in libs/', 'shared', 'Next');
    await prompt('Package name (how apps import it)', '@pong-network/shared', 'Create');
    await expect.poll(() => readFileSync(files[1]!, 'utf8')).toContain('"@pong-network/shared/*"');
    await expect
      .poll(() => readFileSync(files[0]!, 'utf8'))
      .toContain('packages: ["apps/*", "libs/*"]');
    for (const index of [2, 3])
      await expect
        .poll(() => readFileSync(files[index]!, 'utf8'))
        .toContain('"@pong-network/shared": "workspace:*"');

    await components.getByRole('button', { name: 'New' }).click();
    await page.getByRole('menuitem', { name: /New component in shared library/ }).click();
    await prompt('Name', 'Player', 'Create');
    await expect
      .poll(() => readFileSync(join(libs, 'shared/src/components/player.ts'), 'utf8'))
      .toContain('@side shared');

    await showPanel(page, 'Hierarchy');
    await entity(page, 'ball').click();
    await showPanel(page, 'Components');
    await components.getByRole('button', { name: 'C Player', exact: true }).click();
    await components.getByRole('button', { name: 'Add to ball' }).click();
    await expect
      .poll(main)
      .toContain('import { Player } from "@pong-network/shared/components/player";');
    expect(main()).toContain('registry.addComponent(ball, new Player());');

    await components.getByRole('button', { name: 'New' }).click();
    await page.getByRole('menuitem', { name: /New component in app/ }).click();
    await prompt('Name', 'Health', 'Create');
    await expect.poll(() => readFileSync(health, 'utf8')).toContain('export class Health');
    await showPanel(page, 'Components');
    await components.getByRole('button', { name: 'C Health', exact: true }).click();
    await components.getByRole('button', { name: 'Move to shared library' }).click();
    await page.getByRole('menuitem', { name: /Move to shared library/ }).click();
    await expect.poll(() => existsSync(join(libs, 'shared/src/components/health.ts'))).toBe(true);
    expect(existsSync(health)).toBe(false);

    const bad = join(libs, 'shared/src/components/bad.ts');
    writeFileSync(
      bad,
      'import { layer } from "../../../../apps/client/src/main";\nexport const x = layer;\n',
    );
    await expect(
      components.getByRole('alert').filter({ hasText: "a shared library can't import an app" }),
    ).toBeVisible();
    rmSync(bad);
    await expect(
      components.getByRole('alert').filter({ hasText: "can't import an app" }),
    ).toHaveCount(0);

    await components.getByRole('button', { name: 'New' }).click();
    await page.getByRole('menuitem', { name: /New component in shared library/ }).click();
    await prompt('Name', 'Position', 'Create');
    await expect(
      components.getByRole('alert').filter({ hasText: 'named “Position”' }),
    ).toBeVisible();

    await components.getByRole('button', { name: 'C Player', exact: true }).click();
    await page.keyboard.press('Control+z');
    await expect.poll(() => existsSync(health)).toBe(true);
    expect(existsSync(join(libs, 'shared/src/components/health.ts'))).toBe(false);

    rmSync(join(libs, 'shared/src/components/position.ts'), { force: true });
    rmSync(join(libs, 'shared/src/components/player.ts'), { force: true });
    await page.keyboard.press('Control+z');
    await expect.poll(() => existsSync(join(libs, 'shared'))).toBe(false);
    expect(readFileSync(files[1]!, 'utf8')).toBe(saved[1]);
    expect(readFileSync(files[0]!, 'utf8')).toBe(saved[0]);
    expect(readFileSync(files[2]!, 'utf8')).toBe(saved[2]);
    expect(readFileSync(files[4]!, 'utf8')).toBe(saved[4]);
  } finally {
    files.forEach((file, index) => writeFileSync(file, saved[index]!));
    rmSync(libs, { recursive: true, force: true });
    rmSync(health, { force: true });
  }
});

test('drags an entity in the 2D scene: its position is written to main.ts', async ({ page }) => {
  await page.getByRole('tab', { name: 'Scene', exact: true }).click();
  const scene = page.getByRole('application', { name: '2D scene' });
  await expect(scene).toBeVisible();
  const line = scene.getByRole('button', { name: 'terrainLine (rect)' });
  const box = (await line.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2 + 20, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(main)
    .not.toContain('registry.addComponent(terrainLine, new Position(955, 0));');
  expect(main()).toMatch(/registry\.addComponent\(terrainLine, new Position\(\d+, \d+\)\);/);
  await expect(line).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('Control+z');
  await expect.poll(main).toContain('registry.addComponent(terrainLine, new Position(955, 0));');

  const fit = page.getByRole('button', { name: 'Fit', exact: true });
  await expect(fit).toBeDisabled();
  await page.mouse.wheel(0, -300);
  await expect(fit).toBeEnabled();
  await fit.click();
  await expect(fit).toBeDisabled();
  await page.getByRole('tab', { name: 'Project' }).click();
});

test('opens a component in code at its declaration, shown in the Component panel', async ({
  page,
}) => {
  const components = page.getByRole('region', { name: 'Components', exact: true });
  await showPanel(page, 'Components');
  await components.getByRole('button', { name: /^C Position\b/ }).click();
  await components.getByRole('button', { name: 'Open in code' }).click();
  const panel = page.getByRole('complementary', { name: 'Component panel' });
  await expect(panel.getByRole('button', { name: 'Component to edit' })).toContainText('Position');
  await expect(page.locator('.monaco-editor .current-line').first()).toBeVisible();
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('export class Position');
});

test('switches the app, and adds and removes a system', async ({ page }) => {
  const SERVER = join(PONG, 'apps/server/src/main.ts');
  const serverBefore = readFileSync(SERVER, 'utf8');
  try {
    await expect(entity(page, 'terrain')).toBeVisible();
    await page.getByRole('button', { name: 'App', exact: true }).click();
    await page.getByRole('option', { name: 'pong-network-server' }).click();
    await expect(entity(page, 'ball')).toBeVisible();
    await expect(entity(page, 'terrain')).toHaveCount(0);

    await showPanel(page, 'Systems');
    const systems = page.getByRole('tree', { name: 'Systems in run order' });
    await expect(systems.getByRole('treeitem')).toHaveCount(3);
    await systems.getByRole('treeitem', { name: /^bounce/ }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Remove from app' }).click();
    await expect
      .poll(() => readFileSync(SERVER, 'utf8'))
      .not.toContain('registry.addSystem(bounce);');
    await page.getByRole('combobox', { name: 'Add system' }).click();
    await page.keyboard.type('bounce');
    await page.getByRole('option', { name: /bounce/ }).click();
    await expect
      .poll(() => readFileSync(SERVER, 'utf8'))
      .toContain('registry.addSystem(move);\n  registry.addSystem(bounce);');
  } finally {
    writeFileSync(SERVER, serverBefore);
    await showPanel(page, 'Hierarchy');
    await page.getByRole('button', { name: 'App', exact: true }).click();
    await page.getByRole('option', { name: 'pong-network-client' }).click();
  }
});

test('shows a hidden param when chosen, and keeps it shown after a reload', async ({ page }) => {
  const COMPONENTS = join(PONG, 'apps/client/src/components/components.ts');
  const before = readFileSync(COMPONENTS, 'utf8');
  const position =
    'export class Position {\n  name = "Position";\n  x: number;\n  y: number;\n\n  constructor(x: number, y: number)';
  expect(before).toContain(position);
  writeFileSync(
    COMPONENTS,
    before.replace(
      position,
      position.replace('constructor(x: number', 'constructor(/** @hidden */ x: number'),
    ),
  );
  try {
    await entity(page, 'ball').click();
    await showPanel(page, 'Inspector');
    const card = page.getByRole('region', { name: 'Position' });
    await expect(card.getByRole('button', { name: 'Show hidden (1)' })).toBeVisible();
    await expect(card.getByRole('textbox', { name: 'x', exact: true })).toHaveCount(0);
    await card.getByRole('button', { name: 'Show hidden (1)' }).click();
    await page.getByRole('menuitem', { name: 'x' }).click();
    await expect(card.getByRole('textbox', { name: 'x', exact: true })).toBeVisible();

    await page.reload();
    await showPanel(page, 'Hierarchy');
    await entity(page, 'ball').click();
    await showPanel(page, 'Inspector');
    await expect(
      page
        .getByRole('region', { name: 'Position' })
        .getByRole('textbox', { name: 'x', exact: true }),
    ).toBeVisible();
  } finally {
    writeFileSync(COMPONENTS, before);
  }
});
