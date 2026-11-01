import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { openProject, resetLayout, saved, showPanel } from './helpers';
import { type Page, expect, test } from './test';
import { PONG, WORKSPACE } from './workspace';

const REMOTE = join(WORKSPACE, 'git-remote.git');
const OTHER = join(WORKSPACE, 'git-other');
const FILE = 'scratch/rename-me.txt';
const OTHER_FILE = 'scratch/move-me.txt';
const NEW_FILE = 'scratch/brand-new.txt';

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_CEILING_DIRECTORIES: WORKSPACE },
  });
const commitPanel = (page: Page) => page.getByRole('region', { name: 'Commit', exact: true });
const logPanel = (page: Page) => page.getByRole('region', { name: 'Git', exact: true });
const group = (page: Page, name: string) =>
  commitPanel(page).getByRole('region', { name, exact: true });
const row = (page: Page, list: string, path: string) =>
  group(page, list).getByRole('option', { name: path, exact: true });
const vcs = async (page: Page, entry: string) => {
  await page.getByRole('button', { name: 'VCS', exact: true }).click();
  await page
    .getByRole('menuitem', { name: new RegExp(`^${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })
    .click();
};
const message = (page: Page) => commitPanel(page).getByRole('textbox', { name: 'Commit message' });
const commit = async (page: Page, text: string, button = 'Commit') => {
  await message(page).fill(text);
  await commitPanel(page).getByRole('button', { name: button, exact: true }).click();
  await expect(message(page)).toHaveValue('');
};
const branchStatus = (page: Page, text: string) =>
  page.getByRole('contentinfo').getByRole('button', { name: text, exact: true });
const commits = (page: Page) => logPanel(page).getByRole('grid', { name: 'Commits' });

const original = readFileSync(join(PONG, FILE), 'utf8');
const otherOriginal = readFileSync(join(PONG, OTHER_FILE), 'utf8');
const cleanup = () => {
  for (const path of [join(PONG, '.git'), REMOTE, OTHER])
    rmSync(path, { recursive: true, force: true });
  writeFileSync(join(PONG, FILE), original);
  writeFileSync(join(PONG, OTHER_FILE), otherOriginal);
  rmSync(join(PONG, NEW_FILE), { force: true });
};
test.beforeEach(cleanup);
/** The shown panels are saved with the layout: put Files and Console back. */
test.afterEach(async ({ page }) => {
  await showPanel(page, 'Files').catch(() => undefined);
  await showPanel(page, 'Console').catch(() => undefined);
  await saved(page).catch(() => undefined);
});
test.afterEach(async () => {
  for (let clean = 0, attempt = 0; clean < 2 && attempt < 20; attempt++) {
    clean = existsSync(join(PONG, '.git')) ? 0 : clean + 1;
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
});

/** A repository with every file of the project in one commit, as `git` makes it. */
const initRepository = () => {
  git(PONG, 'init', '--quiet', '-b', 'main');
  git(PONG, 'config', 'user.name', 'E2E');
  git(PONG, 'config', 'user.email', 'e2e@example.com');
  git(PONG, 'add', '-A');
  git(PONG, 'commit', '--quiet', '-m', 'first commit');
};
/** Opens pong on the full layout, with the Commit panel shown. */
const open = async (page: Page) => {
  await openProject(page, 'pong');
  await page.waitForURL(/\/project\//);
  await expect(page.getByRole('tab', { name: 'Files' })).toBeVisible();
  await resetLayout(page);
  await showPanel(page, 'Commit');
};
const commitButton = (page: Page) =>
  commitPanel(page).getByRole('button', { name: 'Commit', exact: true });
const pushDialog = async (page: Page) => {
  const dialog = page.getByRole('dialog', { name: 'Push commits' });
  await expect(dialog).toBeVisible();
  return dialog;
};
const changed = (page: Page) => row(page, 'Changes', FILE);

test('initializes a repository, commits what is checked and shows the log', async ({ page }) => {
  await open(page);
  await expect(commitPanel(page).getByText('This project is not a git repository')).toBeVisible();
  await vcs(page, 'Initialize repository');
  await expect(group(page, 'Unversioned files')).toBeVisible();
  git(PONG, 'config', 'user.name', 'E2E');
  git(PONG, 'config', 'user.email', 'e2e@example.com');

  const nested = row(page, 'Unversioned files', 'apps/client/src/main.ts');
  await expect(nested).toContainText('main.ts');
  await expect(nested).toContainText('apps/client/src');
  await message(page).fill('first commit');
  await expect(commitButton(page)).toBeDisabled();
  const includeAll = group(page, 'Unversioned files').getByRole('checkbox', {
    name: 'Include all: Unversioned files',
    includeHidden: true,
  });
  await nested.getByRole('checkbox').check();
  expect(await includeAll.evaluate((box: HTMLInputElement) => box.indeterminate)).toBe(true);
  await includeAll.check();
  await commit(page, 'first commit');
  await expect(row(page, 'Unversioned files', 'package.json')).toHaveCount(0);
  await expect(branchStatus(page, 'main')).toBeVisible();

  await showPanel(page, 'Git');
  const first = commits(page).getByRole('row', { name: /first commit/ });
  await expect(first).toContainText('E2E');
  await expect(first).toContainText('Today');
  await first.click();
  const details = logPanel(page).getByRole('complementary', { name: 'Commit details' });
  await expect(details.getByRole('heading', { name: 'first commit' })).toBeVisible();
  await expect(details.getByRole('button', { name: 'package.json', exact: true })).toBeVisible();
});

test('shows a change in the Files panel and as a diff, and keeps the panel state', async ({
  page,
}) => {
  initRepository();
  await open(page);
  writeFileSync(join(PONG, FILE), 'renamed\n');
  await expect(changed(page)).toContainText('rename-me.txt');
  await expect(changed(page).getByRole('checkbox', { name: `Include ${FILE}` })).toBeChecked();
  await showPanel(page, 'Files');
  const files = page.getByRole('tree', { name: 'Project files' });
  const folder = files.getByRole('treeitem', { name: /^scratch/ });
  await expect(folder).toContainText('•');
  await folder.click();
  await page.keyboard.press('ArrowRight');
  await expect(files.getByRole('treeitem', { name: /^rename-me\.txt/ })).toContainText('M');
  await showPanel(page, 'Commit');

  await changed(page).dblclick();
  await expect(page.getByLabel('Last commit and the file')).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'compared with: Last commit' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close comparison' }).click();
  await page.getByRole('tab', { name: 'rename-me.txt' }).click({ button: 'middle' });
  await page.getByRole('tab', { name: 'Project', exact: true }).click();

  await group(page, 'Changes')
    .getByRole('button', { name: 'Collapse Changes', includeHidden: true })
    .click();
  await expect(changed(page)).toHaveCount(0);
  await expect(group(page, 'Changes')).toContainText('1 file');
  await group(page, 'Changes')
    .getByRole('button', { name: 'Expand Changes', includeHidden: true })
    .click();
  await expect(changed(page)).toBeVisible();

  await changed(page)
    .getByRole('checkbox', { name: `Include ${FILE}` })
    .uncheck();
  await message(page).fill('nothing');
  await commitPanel(page)
    .getByRole('tab', { name: /^Stash/ })
    .click();
  await commitPanel(page).getByRole('tab', { name: 'Commit', exact: true }).click();
  await expect(message(page)).toHaveValue('nothing');
  await expect(changed(page).getByRole('checkbox', { name: `Include ${FILE}` })).not.toBeChecked();
  await expect(commitButton(page)).toBeDisabled();
  await message(page).fill('');
});

test('selects changes, rolls them back, adds and deletes an unversioned file', async ({ page }) => {
  initRepository();
  await open(page);
  writeFileSync(join(PONG, FILE), 'renamed\n');
  await expect(changed(page)).toBeVisible();

  const rollBack = commitPanel(page).getByRole('button', { name: 'Rollback' });
  await commitPanel(page)
    .getByRole('group', { name: 'Changed files' })
    .click({
      position: { x: 100, y: 200 },
    });
  await expect(changed(page)).toHaveAttribute('aria-selected', 'false');
  await expect(rollBack).toBeDisabled();
  writeFileSync(join(PONG, OTHER_FILE), 'moved\n');
  const alsoChanged = row(page, 'Changes', OTHER_FILE);
  await expect(alsoChanged).toBeVisible();
  await group(page, 'Changes').getByText('Changes', { exact: true }).click();
  await expect(changed(page)).toHaveAttribute('aria-selected', 'true');
  await expect(alsoChanged).toHaveAttribute('aria-selected', 'true');
  await alsoChanged.click({ modifiers: ['Control'] });
  await expect(alsoChanged).toHaveAttribute('aria-selected', 'false');
  await alsoChanged.click({ modifiers: ['Control'] });
  await rollBack.click();
  await expect(page.getByRole('heading', { name: 'Rollback the 2 selected files?' })).toBeVisible();
  await page.getByRole('button', { name: 'Rollback', exact: true }).last().click();
  await expect(changed(page)).toHaveCount(0);
  await expect(alsoChanged).toHaveCount(0);
  expect(readFileSync(join(PONG, FILE), 'utf8')).toBe(original);
  expect(readFileSync(join(PONG, OTHER_FILE), 'utf8')).toBe(otherOriginal);

  writeFileSync(join(PONG, FILE), 'again\n');
  await changed(page).click();
  await page.keyboard.press('Space');
  await expect(changed(page).getByRole('checkbox')).not.toBeChecked();
  await page.keyboard.press('Space');
  await expect(changed(page).getByRole('checkbox')).toBeChecked();
  await changed(page).click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: /^Show diff/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /^Jump to source/ })).toBeVisible();
  await page.getByRole('menuitem', { name: /^Rollback…/ }).click();
  await expect(page.getByRole('heading', { name: `Rollback ${FILE}?` })).toBeVisible();
  await page.getByRole('button', { name: 'Rollback', exact: true }).last().click();
  await expect(changed(page)).toHaveCount(0);

  writeFileSync(join(PONG, NEW_FILE), 'new\n');
  await row(page, 'Unversioned files', NEW_FILE).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Add to VCS' }).click();
  await expect(row(page, 'Changes', NEW_FILE)).toBeVisible();
  await row(page, 'Changes', NEW_FILE).click();
  await rollBack.click();
  await page.getByRole('button', { name: 'Rollback', exact: true }).last().click();
  await row(page, 'Unversioned files', NEW_FILE).click();
  await page.keyboard.press('Delete');
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
  await expect(row(page, 'Unversioned files', NEW_FILE)).toHaveCount(0);
});

test('creates, checks out and deletes a branch', async ({ page }) => {
  initRepository();
  await open(page);
  await showPanel(page, 'Git');
  await vcs(page, 'New branch…');
  await page.getByRole('textbox', { name: 'Branch name' }).fill('feature');
  await page.getByRole('button', { name: 'Create branch' }).click();
  await expect(branchStatus(page, 'feature')).toBeVisible();
  const local = logPanel(page).getByRole('list', { name: 'Local branches' });
  await local.getByRole('button', { name: 'main', exact: true }).dblclick();
  await expect(branchStatus(page, 'main')).toBeVisible();
  await local.getByRole('button', { name: 'feature', exact: true }).click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: "New branch from 'feature'…" })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
  await expect(local.getByRole('button', { name: 'feature', exact: true })).toHaveCount(0);
});

test('pushes, fetches, filters the log, merges a conflict and pushes the merge', async ({
  page,
}) => {
  test.setTimeout(90_000);
  initRepository();
  await open(page);
  await showPanel(page, 'Git');
  git(WORKSPACE, 'init', '--quiet', '--bare', '-b', 'main', REMOTE);
  git(PONG, 'remote', 'add', 'origin', REMOTE);
  const shown = logPanel(page).getByRole('status', { name: 'Branch shown' });
  await vcs(page, 'Push…');
  const firstPush = await pushDialog(page);
  await expect(firstPush).toContainText('main → origin/main');
  await expect(firstPush.getByRole('list', { name: 'Commits to push' })).toContainText(
    'first commit',
  );
  await firstPush.getByRole('button', { name: 'Push', exact: true }).click();
  await expect(shown).toHaveText('Branch: main ↑0 ↓0');
  git(WORKSPACE, 'clone', '--quiet', REMOTE, OTHER);
  git(OTHER, 'config', 'user.name', 'Other');
  git(OTHER, 'config', 'user.email', 'other@example.com');
  writeFileSync(join(OTHER, FILE), 'theirs\n');
  git(OTHER, 'commit', '--quiet', '-am', 'their change');
  git(OTHER, 'push', '--quiet');
  await logPanel(page).getByRole('button', { name: 'Fetch all remotes' }).click();
  await expect(branchStatus(page, 'main ↓1')).toBeVisible();
  const remote = logPanel(page).getByRole('list', { name: 'Branches of origin' });
  await remote.getByRole('button', { name: 'main', exact: true }).click();
  await expect(commits(page).getByRole('row', { name: /their change/ })).toBeVisible();
  await logPanel(page).getByRole('button', { name: 'User', exact: true }).click();
  await page.getByRole('option', { name: 'User: E2E' }).click();
  await expect(commits(page).getByRole('row', { name: /their change/ })).toHaveCount(0);
  await logPanel(page).getByRole('button', { name: 'User', exact: true }).click();
  await page.getByRole('option', { name: 'User: All' }).click();
  await logPanel(page).getByRole('button', { name: 'HEAD (Current Branch)' }).click();
  await expect(commits(page).getByRole('row', { name: /their change/ })).toHaveCount(0);

  writeFileSync(join(PONG, FILE), 'mine\n');
  await expect(changed(page)).toBeVisible();
  await commit(page, 'my change');
  await expect(branchStatus(page, 'main ↑1 ↓1')).toBeVisible();
  await vcs(page, 'Update project');
  await expect(page.getByText('The update stopped on conflicts').last()).toBeVisible();
  const conflict = row(page, 'Merge conflicts', FILE);
  await expect(conflict).toBeVisible();
  writeFileSync(join(PONG, FILE), 'both\n');
  await conflict.getByRole('button', { name: 'Mark resolved' }).click();
  await expect(group(page, 'Merge conflicts')).toHaveCount(0);
  await commit(page, 'merge', 'Commit and push…');
  const afterMerge = await pushDialog(page);
  await expect(afterMerge.getByRole('list', { name: 'Commits to push' })).toContainText('merge');
  await afterMerge.getByRole('button', { name: 'Push', exact: true }).click();
  await expect(branchStatus(page, 'main')).toBeVisible();
  await expect(commits(page).getByRole('row').first()).toContainText('merge');
});

test('amends the last commit from its message, and offers earlier messages', async ({ page }) => {
  initRepository();
  await open(page);
  await showPanel(page, 'Git');
  writeFileSync(join(PONG, FILE), 'mine\n');
  await expect(changed(page)).toBeVisible();
  await commit(page, 'my change');
  writeFileSync(join(PONG, FILE), 'mine, amended\n');
  await expect(changed(page)).toBeVisible();
  await commitPanel(page).getByRole('checkbox', { name: 'Amend' }).check();
  await expect(message(page)).toHaveValue('my change');
  await commit(page, 'my change, amended');
  await expect(commits(page).getByRole('row').first()).toContainText('my change, amended');
  await expect(changed(page)).toHaveCount(0);
  await commitPanel(page).getByRole('button', { name: 'Commit message history' }).click();
  await page.getByRole('menuitem', { name: 'my change', exact: true }).click();
  await expect(message(page)).toHaveValue('my change');
  await message(page).fill('');
});

test('stashes changes and pops them back', async ({ page }) => {
  initRepository();
  await open(page);
  writeFileSync(join(PONG, FILE), 'work in progress\n');
  await expect(changed(page)).toBeVisible();
  await vcs(page, 'Stash changes…');
  await page.getByRole('textbox', { name: 'Message (optional)' }).fill('wip');
  await page.getByRole('button', { name: 'Stash', exact: true }).click();
  await expect(changed(page)).toHaveCount(0);
  expect(readFileSync(join(PONG, FILE), 'utf8')).toBe(original);
  await commitPanel(page)
    .getByRole('tab', { name: /^Stash/ })
    .click();
  const stashed = commitPanel(page).getByRole('listitem', { name: 'On main: wip' });
  await stashed.getByRole('button', { name: 'Pop' }).click();
  await expect(commitPanel(page).getByText('No stash.')).toBeVisible();
  expect(readFileSync(join(PONG, FILE), 'utf8')).toBe('work in progress\n');
});

test('browses, folds and includes changes from the keyboard', async ({ page }) => {
  await openProject(page, 'pong');
  await page.waitForURL(/\/project\//);
  await resetLayout(page);
  await showPanel(page, 'Commit');
  await vcs(page, 'Initialize repository');
  const files = commitPanel(page).getByRole('group', { name: 'Changed files' });
  const node = commitPanel(page).getByRole('button', { name: /^Unversioned files, / });
  const includeAll = commitPanel(page).getByRole('checkbox', {
    name: 'Include all: Unversioned files',
    includeHidden: true,
  });
  const active = () =>
    files.evaluate(
      (list) =>
        document.getElementById(list.getAttribute('aria-activedescendant') ?? '')?.ariaLabel ?? '',
    );
  await expect(node).toBeVisible();
  await files.focus();
  await page.keyboard.press('ArrowDown');
  await expect.poll(active).toMatch(/^Changes, 0 files/);
  await page.keyboard.press('ArrowDown');
  await expect.poll(active).toMatch(/^Unversioned files, /);
  await page.keyboard.press('Space');
  await expect(includeAll).toBeChecked();
  await page.keyboard.press('Space');
  await expect(includeAll).not.toBeChecked();
  await page.keyboard.press('ArrowLeft');
  await expect(node).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('ArrowRight');
  await expect(node).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowRight');
  await expect.poll(active).not.toMatch(/^Unversioned files/);
  await expect(
    group(page, 'Unversioned files').getByRole('option', { selected: true }),
  ).toHaveCount(1);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(active).toMatch(/^Unversioned files, /);
  await resetLayout(page);
  await saved(page);
});
