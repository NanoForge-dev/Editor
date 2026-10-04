import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { resetLayout, showPanel } from './helpers';
import { type Page, expect, test } from './test';
import { PONG, REGISTRY, WORKSPACE } from './workspace';

const USER_PLUGINS = join(WORKSPACE, '.data/plugins');
const TSCONFIG = join(PONG, 'tsconfig.json');
const LIST = join(PONG, 'nanoforge.packages.json');
const LOCK = join(PONG, 'nanoforge.packages.lock.json');
/** Versions the tests publish while they run. */
const PUBLISHED = [join(REGISTRY, '@acme/badge/1.1.0'), join(REGISTRY, '@acme/shapes/1.1.0')];
let tsconfig: string;

/** Publishes a version in the folder registry: the files of another version, with its number. */
const publish = (name: string, from: string, version: string) => {
  for (const file of ['nanoforge.manifest.json', 'index.js', 'components/hull.ts']) {
    const source = join(REGISTRY, name, from, file);
    if (!existsSync(source)) continue;
    const target = join(REGISTRY, name, version, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(source, 'utf8').replace(`"${from}"`, `"${version}"`));
  }
};

const cleanUp = () => {
  for (const folder of [...PUBLISHED, join(USER_PLUGINS, '@acme'), join(PONG, 'nf_modules/@acme')])
    rmSync(folder, { recursive: true, force: true });
  rmSync(LIST, { force: true });
  rmSync(LOCK, { force: true });
};

const open = async (page: Page) => {
  await page.goto('/load?path=pong');
  await page.waitForURL(/\/project\//);
  await resetLayout(page);
};

const openPlugins = async (page: Page, tab: 'Marketplace' | 'Installed') => {
  await page.locator('[data-nf-part="screen"]').click();
  await page.keyboard.press('Control+Alt+s');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('treeitem', { name: 'Plugins' }).click();
  const plugins = dialog.getByRole('region', { name: 'Plugins' });
  await plugins.getByRole('tab', { name: tab }).click();
  return plugins;
};

const openPackages = async (page: Page) => {
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Packages…' }).click();
  return page.getByRole('dialog', { name: 'Packages' });
};

test.beforeEach(() => {
  tsconfig = readFileSync(TSCONFIG, 'utf8');
  cleanUp();
});

test.afterEach(() => {
  cleanUp();
  writeFileSync(TSCONFIG, tsconfig);
});

test('installs a plugin from the marketplace, updates it and uninstalls it', async ({ page }) => {
  await open(page);
  let plugins = await openPlugins(page, 'Marketplace');
  await plugins.getByRole('textbox', { name: 'Search plugins' }).fill('badge');
  const results = plugins.getByRole('list', { name: 'Marketplace plugins' });
  await expect(results.getByRole('button')).toHaveCount(1);
  await expect(results.getByText('1.0.0 · Acme · 1.3k downloads')).toBeVisible();
  const details = plugins.getByLabel('Plugin details');
  await expect(details.getByText('A plugin of the test registry.')).toBeVisible();

  await plugins.getByRole('textbox', { name: 'Search plugins' }).fill('nothing-like-this');
  await expect(plugins.getByText('No plugin matches')).toBeVisible();
  await plugins.getByRole('textbox', { name: 'Search plugins' }).fill('');

  await details.getByRole('button', { name: 'Install @acme/badge' }).click();
  await page.getByRole('menuitem', { name: 'For me (every project)' }).click();
  await expect(plugins.getByRole('status')).toContainText('reload the editor to finish');
  await expect(details.getByText('Installed', { exact: true })).toBeVisible();
  expect(existsSync(join(USER_PLUGINS, '@acme/badge/index.js'))).toBe(true);

  await plugins.getByRole('button', { name: 'Reload now' }).click();
  await page.waitForURL(/\/project\//);
  await expect(page.locator('[data-nf-part="screen"]')).toBeVisible();

  rmSync(join(USER_PLUGINS, '@acme'), { recursive: true });
  await page.reload();
  await page.waitForURL(/\/project\//);
  await expect(page.getByText('A plugin of your account is not installed here')).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Install', exact: true }).click();
  await expect(page.getByText('Plugins installed: reload the editor to finish')).toBeVisible();
  expect(existsSync(join(USER_PLUGINS, '@acme/badge/index.js'))).toBe(true);
  await page.getByRole('button', { name: 'Reload now' }).click();
  await page.waitForURL(/\/project\//);
  await expect(page.locator('[data-nf-part="screen"]')).toBeVisible();

  publish('@acme/badge', '1.0.0', '1.1.0');
  plugins = await openPlugins(page, 'Installed');
  await expect(
    plugins.getByText('@acme/badge · 1.0.0 · installed for me · active', { exact: false }),
  ).toBeVisible();
  await plugins.getByRole('button', { name: 'Update Badge to 1.1.0' }).click();
  await expect(plugins.getByText('1.1.0 installed, reload to finish')).toBeVisible();
  await plugins.getByRole('button', { name: 'Reload now' }).click();
  await page.waitForURL(/\/project\//);
  await expect(page.locator('[data-nf-part="screen"]')).toBeVisible();

  plugins = await openPlugins(page, 'Installed');
  await expect(plugins.getByText('@acme/badge · 1.1.0 ·', { exact: false })).toBeVisible();
  await plugins.getByRole('button', { name: 'Uninstall Badge' }).click();
  await expect(plugins.getByText('removed, reload to finish')).toBeVisible();
  expect(existsSync(join(USER_PLUGINS, '@acme/badge'))).toBe(false);
  await plugins.getByRole('tab', { name: 'Marketplace' }).click();
  await expect(plugins.getByRole('button', { name: 'Install @acme/badge' })).toBeVisible();
  await plugins.getByRole('button', { name: 'Reload now' }).click();
  await page.waitForURL(/\/project\//);
  plugins = await openPlugins(page, 'Installed');
  await expect(plugins.getByText('@acme/hello', { exact: false })).toBeVisible();
  await expect(plugins.getByText('@acme/badge', { exact: false })).toHaveCount(0);
  await page.keyboard.press('Escape');
});

test('installs a package with its dependency, updates it and uninstalls it', async ({ page }) => {
  await open(page);
  let dialog = await openPackages(page);
  await dialog.getByRole('textbox', { name: 'Search packages' }).fill('render');
  const results = dialog.getByRole('list', { name: 'Registry packages' });
  await expect(results.getByRole('button')).toHaveCount(1);
  const details = dialog.getByLabel('Package details');
  await expect(details.getByRole('list', { name: 'Dependencies' })).toContainText(
    '@acme/shapes ^1.0.0',
  );
  await details.getByRole('button', { name: 'Install @acme/render' }).click();
  await expect(dialog.getByRole('tab', { name: 'Installed (2)' })).toBeVisible();
  await expect(details.getByText('1.0.0 installed')).toBeVisible();

  expect(existsSync(join(PONG, 'nf_modules/@acme/render/nanoforge.manifest.json'))).toBe(true);
  expect(existsSync(join(PONG, 'nf_modules/@acme/shapes/components/hull.ts'))).toBe(true);
  expect(JSON.parse(readFileSync(LIST, 'utf8'))).toEqual({
    packages: { '@acme/render': '^1.0.0' },
  });
  expect(readFileSync(TSCONFIG, 'utf8')).toContain(
    '"@acme/shapes/*": ["./nf_modules/@acme/shapes/*"]',
  );

  await dialog.getByRole('tab', { name: 'Installed (2)' }).click();
  const installed = dialog.getByRole('list', { name: 'Installed packages' });
  await expect(installed.getByText('1.0.0 · asked for as ^1.0.0')).toBeVisible();
  await expect(installed.getByText('1.0.0 · needed by @acme/render')).toBeVisible();
  await expect(installed.getByRole('button', { name: 'Uninstall @acme/shapes' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Close' }).first().click();

  await showPanel(page, 'Components');
  const components = page.getByRole('region', { name: 'Components', exact: true });
  await expect(components.getByRole('button', { name: 'C Hull', exact: true })).toBeVisible();

  publish('@acme/shapes', '1.0.0', '1.1.0');
  dialog = await openPackages(page);
  await dialog.getByRole('tab', { name: 'Installed (2)' }).click();
  await dialog.getByRole('button', { name: 'Update @acme/shapes to 1.1.0' }).click();
  await expect(
    dialog.getByRole('list', { name: 'Installed packages' }).getByText('1.1.0 · needed by'),
  ).toBeVisible();
  expect(
    readFileSync(join(PONG, 'nf_modules/@acme/shapes/nanoforge.manifest.json'), 'utf8'),
  ).toContain('"1.1.0"');

  rmSync(join(PONG, 'nf_modules/@acme'), { recursive: true });
  await dialog.getByRole('button', { name: 'Close' }).first().click();
  dialog = await openPackages(page);
  await expect(dialog.getByText('2 packages of this project are not in nf_modules.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Restore packages' }).click();
  await expect(dialog.getByRole('button', { name: 'Restore packages' })).toHaveCount(0);
  expect(existsSync(join(PONG, 'nf_modules/@acme/shapes/components/hull.ts'))).toBe(true);

  await dialog.getByRole('tab', { name: 'Installed (2)' }).click();
  await dialog.getByRole('button', { name: 'Uninstall @acme/render' }).click();
  await expect(dialog.getByText('No packages in this project')).toBeVisible();
  expect(existsSync(join(PONG, 'nf_modules/@acme'))).toBe(false);
  expect(readFileSync(TSCONFIG, 'utf8')).not.toContain('@acme');
  await dialog.getByRole('button', { name: 'Close' }).first().click();
  await showPanel(page, 'Components');
  await expect(components.getByRole('button', { name: 'C Hull', exact: true })).toHaveCount(0);
  await resetLayout(page);
  await page.waitForTimeout(1500);
});
