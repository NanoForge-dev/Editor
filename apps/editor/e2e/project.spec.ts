import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { resetLayout, showPanel } from './helpers';
import { expect, test } from './test';
import { PONG } from './workspace';

const FILES = [
  'nanoforge.config.ts',
  'tsconfig.json',
  'apps/client/package.json',
  'apps/server/package.json',
  'apps/client/src/main.ts',
  '.nanoforge/editor/local.json',
  'apps/client/nanoforge.config.ts',
  'apps/server/nanoforge.config.ts',
].map((name) => join(PONG, name));
const [CONFIG, TSCONFIG, CLIENT, SERVER, MAIN, , CLIENT_CONFIG, SERVER_CONFIG] =
  FILES as string[] as [string, string, string, string, string, string, string, string];
const LIBS = join(PONG, 'libs');
const SERVER_COPY = join(PONG, 'apps/server-2');
let saved: (string | undefined)[];

const read = (file: string) => readFileSync(file, 'utf8');
const dependencies = (file: string) =>
  (JSON.parse(read(file)) as { dependencies?: Record<string, string> }).dependencies ?? {};

test.beforeEach(async ({ page }) => {
  saved = FILES.map((file) => (existsSync(file) ? read(file) : undefined));
  await page.goto('/load?path=pong');
  await page.waitForURL(/\/project\//);
  await resetLayout(page);
  await page.getByRole('tab', { name: 'Project', exact: true }).click();
});

test.afterEach(async ({ page }) => {
  await page.waitForTimeout(900);
  FILES.forEach((file, index) => {
    if (saved[index] === undefined) rmSync(file, { force: true });
    else writeFileSync(file, saved[index]);
  });
  rmSync(LIBS, { recursive: true, force: true });
  rmSync(SERVER_COPY, { recursive: true, force: true });
});

test('adds a shared library, chooses the apps that use it, renames and removes it', async ({
  page,
}) => {
  const libraries = page.getByRole('region', { name: 'Shared libraries' });
  const card = (name: string) => page.getByRole('article', { name, exact: true });
  const components = page.getByRole('region', { name: 'Components', exact: true });

  await page.getByRole('button', { name: 'Add shared library' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add shared library' });
  await expect(dialog.getByRole('textbox', { name: 'Package name' })).toHaveValue(
    '@pong-network/shared',
  );
  await dialog.getByRole('textbox', { name: 'Folder in libs/' }).fill('Not A Folder');
  await expect(dialog.getByRole('alert').first()).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Add library' })).toBeDisabled();
  await dialog.getByRole('textbox', { name: 'Folder in libs/' }).fill('shared');
  await dialog.getByRole('button', { name: 'Add library' }).click();

  await expect(card('@pong-network/shared')).toBeVisible();
  await expect.poll(() => dependencies(SERVER)).toEqual({ '@pong-network/shared': 'workspace:*' });
  expect(dependencies(CLIENT)).toEqual({ '@pong-network/shared': 'workspace:*' });
  expect(read(CONFIG)).toContain('packages: ["apps/*", "libs/*"]');
  expect(read(TSCONFIG)).toContain('"@pong-network/shared/*": ["./libs/shared/src/*"]');
  for (const config of [CLIENT_CONFIG, SERVER_CONFIG])
    expect(read(config)).toContain('libs: ["../../libs/shared"],');
  await expect(card('pong-network-server')).toContainText('Uses @pong-network/shared');

  writeFileSync(SERVER_CONFIG, read(SERVER_CONFIG).replace('["../../libs/shared"]', '[]'));
  const serverUse = card('@pong-network/shared').getByRole('checkbox', {
    name: 'pong-network-server',
  });
  await expect(serverUse).not.toBeChecked();
  const mismatch = page.getByText(/depends on @pong-network\/shared, but its libs does not list/);
  await expect(mismatch).toBeVisible();
  await serverUse.check();
  await expect.poll(() => read(SERVER_CONFIG)).toContain('libs: ["../../libs/shared"]');
  await expect(mismatch).toHaveCount(0);
  expect(dependencies(SERVER)).toEqual({ '@pong-network/shared': 'workspace:*' });

  await showPanel(page, 'Components');
  await components.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: /New component in shared library/ }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Name' }).fill('Score');
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
  await expect(components.getByRole('button', { name: 'C Score', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Project', exact: true }).click();
  await expect(card('@pong-network/shared')).toContainText('1 component or system');

  await card('@pong-network/shared')
    .getByRole('checkbox', { name: 'pong-network-client' })
    .uncheck();
  await expect.poll(() => dependencies(CLIENT)).toEqual({});
  expect(read(CLIENT_CONFIG)).toContain('libs: [],');
  expect(dependencies(SERVER)).toEqual({ '@pong-network/shared': 'workspace:*' });
  await expect(components.getByRole('button', { name: 'C Score', exact: true })).toHaveCount(0);

  await page.keyboard.press('Control+z');
  await expect.poll(() => dependencies(CLIENT)).toEqual({ '@pong-network/shared': 'workspace:*' });
  await expect(components.getByRole('button', { name: 'C Score', exact: true })).toBeVisible();

  writeFileSync(
    MAIN,
    `import { Score } from "@pong-network/shared/components/score";\n${read(MAIN)}\nexport const score = new Score();\n`,
  );
  await page.getByRole('button', { name: 'Actions of @pong-network/shared' }).click();
  await page.getByRole('menuitem', { name: 'Rename…' }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('@pong-network/common');
  await page.getByRole('dialog').getByRole('button', { name: 'Rename', exact: true }).click();
  await expect(card('@pong-network/common')).toBeVisible();
  await expect.poll(() => read(MAIN)).toContain('from "@pong-network/common/components/score"');
  expect(read(TSCONFIG)).toContain('"@pong-network/common/*": ["./libs/shared/src/*"]');
  expect(read(TSCONFIG)).not.toContain('@pong-network/shared');
  expect(dependencies(SERVER)).toEqual({ '@pong-network/common': 'workspace:*' });

  const remove = async () => {
    await page.getByRole('button', { name: 'Actions of @pong-network/common' }).click();
    await page.getByRole('menuitem', { name: 'Remove…' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click();
  };
  await remove();
  await expect(page.getByText('is imported by a file').last()).toBeVisible();
  expect(existsSync(join(LIBS, 'shared/package.json'))).toBe(true);

  writeFileSync(MAIN, saved[4]!);
  await page.waitForTimeout(700);
  await remove();
  await expect(libraries).toHaveCount(0);
  await expect.poll(() => existsSync(join(LIBS, 'shared'))).toBe(false);
  expect(read(TSCONFIG)).not.toContain('@pong-network/common');
  expect(dependencies(CLIENT)).toEqual({});
  expect(dependencies(SERVER)).toEqual({});
});

test('adds a server app as a copy, and the Run menu then chooses which server plays', async ({
  page,
}) => {
  const run = page.getByRole('button', { name: 'Run', exact: true });
  await run.click();
  await expect(page.getByRole('menuitem', { name: 'Play client only' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Server app' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Client app' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Add app' }).click();
  await page.getByRole('menuitem', { name: 'Add server app…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add server app' });
  await expect(dialog.getByRole('textbox', { name: 'Folder in apps/' })).toHaveValue('server-2');
  await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('pong-network-server-2');
  await dialog.getByRole('button', { name: 'Start from' }).click();
  await page.getByRole('option', { name: 'A copy of pong-network-server' }).click();
  await dialog.getByRole('button', { name: 'Add app' }).click();

  await expect(page.getByRole('article', { name: 'pong-network-server-2' })).toBeVisible();
  expect(read(join(SERVER_COPY, 'src/main.ts'))).toBe(read(join(PONG, 'apps/server/src/main.ts')));
  expect((JSON.parse(read(join(SERVER_COPY, 'package.json'))) as { name: string }).name).toBe(
    'pong-network-server-2',
  );

  await run.click();
  await page.getByRole('menuitem', { name: 'Server app' }).click();
  await page.getByRole('menuitem', { name: 'pong-network-server-2' }).click();
  await expect
    .poll(() => (existsSync(FILES[5]!) ? read(FILES[5]!) : ''))
    .toContain('"runtime.serverApp": "apps/server-2"');
  await expect(page.getByRole('menuitem', { name: 'Client app' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Actions of pong-network-server-2' }).click();
  await page.getByRole('menuitem', { name: 'Remove…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('article', { name: 'pong-network-server-2' })).toHaveCount(0);
  await run.click();
  await expect(page.getByRole('menuitem', { name: 'Play client only' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Server app' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: 'Apps' }).click();
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('article', { name: 'pong-network-server-2' })).toBeVisible();
});
