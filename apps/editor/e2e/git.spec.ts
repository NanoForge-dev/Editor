import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { resetLayout, showPanel } from './helpers';
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
const commits = (page: Page) => logPanel(page).getByRole('table', { name: 'Commits' });

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
test.afterEach(async () => {
  for (let clean = 0, attempt = 0; clean < 2 && attempt < 20; attempt++) {
    clean = existsSync(join(PONG, '.git')) ? 0 : clean + 1;
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
});

test('git: VCS menu, commit panel, log, branches, remote, conflict, amend, stash', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.goto('/load?path=pong');
  await page.waitForURL(/\/project\//);
  await expect(page.getByRole('tab', { name: 'Files' })).toBeVisible();
  await resetLayout(page);
  const commitButton = commitPanel(page).getByRole('button', { name: 'Commit', exact: true });
  const push = async () => {
    const dialog = page.getByRole('dialog', { name: 'Push commits' });
    await expect(dialog).toBeVisible();
    return dialog;
  };

  await showPanel(page, 'Commit');
  await expect(commitPanel(page).getByText('This project is not a git repository')).toBeVisible();
  await vcs(page, 'Initialize repository');
  await expect(group(page, 'Unversioned Files')).toBeVisible();
  git(PONG, 'config', 'user.name', 'E2E');
  git(PONG, 'config', 'user.email', 'e2e@example.com');

  const nested = row(page, 'Unversioned Files', 'apps/client/src/main.ts');
  await expect(nested).toContainText('main.ts');
  await expect(nested).toContainText('apps/client/src');
  await message(page).fill('first commit');
  await expect(commitButton).toBeDisabled();
  const includeAll = group(page, 'Unversioned Files').getByRole('checkbox', {
    name: 'Include all: Unversioned Files',
  });
  await nested.getByRole('checkbox').check();
  expect(await includeAll.evaluate((box: HTMLInputElement) => box.indeterminate)).toBe(true);
  await includeAll.check();
  await commit(page, 'first commit');
  await expect(row(page, 'Unversioned Files', 'package.json')).toHaveCount(0);
  await expect(branchStatus(page, 'main')).toBeVisible();

  await showPanel(page, 'Git');
  const first = commits(page).getByRole('row', { name: /first commit/ });
  await expect(first).toContainText('E2E');
  await expect(first).toContainText('Today');
  await first.click();
  const details = logPanel(page).getByRole('complementary', { name: 'Commit details' });
  await expect(details.getByRole('heading', { name: 'first commit' })).toBeVisible();
  await expect(details.getByRole('button', { name: 'package.json', exact: true })).toBeVisible();

  writeFileSync(join(PONG, FILE), 'renamed\n');
  const changed = row(page, 'Changes', FILE);
  await expect(changed).toContainText('rename-me.txt');
  await expect(changed.getByRole('checkbox', { name: `Include ${FILE}` })).toBeChecked();
  await showPanel(page, 'Files');
  const files = page.getByRole('tree', { name: 'Project files' });
  const folder = files.getByRole('treeitem', { name: /^scratch/ });
  await expect(folder).toContainText('•');
  await folder.click();
  await page.keyboard.press('ArrowRight');
  await expect(files.getByRole('treeitem', { name: /^rename-me\.txt/ })).toContainText('M');
  await showPanel(page, 'Commit');

  await changed.dblclick();
  await expect(page.getByLabel('Last commit and the file')).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'compared with: Last commit' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close comparison' }).click();
  await page.getByRole('tab', { name: 'rename-me.txt' }).click({ button: 'middle' });
  await page.getByRole('tab', { name: 'Project', exact: true }).click();

  await group(page, 'Changes').getByRole('button', { name: 'Collapse Changes' }).click();
  await expect(changed).toHaveCount(0);
  await expect(group(page, 'Changes')).toContainText('1 file');
  await group(page, 'Changes').getByRole('button', { name: 'Expand Changes' }).click();
  await expect(changed).toBeVisible();

  await changed.getByRole('checkbox', { name: `Include ${FILE}` }).uncheck();
  await message(page).fill('nothing');
  await commitPanel(page)
    .getByRole('tab', { name: /^Stash/ })
    .click();
  await commitPanel(page).getByRole('tab', { name: 'Commit', exact: true }).click();
  await expect(message(page)).toHaveValue('nothing');
  await expect(changed.getByRole('checkbox', { name: `Include ${FILE}` })).not.toBeChecked();
  await expect(commitButton).toBeDisabled();
  await message(page).fill('');
  await changed.getByRole('checkbox', { name: `Include ${FILE}` }).check();

  const rollBack = commitPanel(page).getByRole('button', { name: 'Rollback' });
  await commitPanel(page)
    .getByRole('group', { name: 'Changed files' })
    .click({
      position: { x: 100, y: 200 },
    });
  await expect(changed).toHaveAttribute('aria-selected', 'false');
  await expect(rollBack).toBeDisabled();
  writeFileSync(join(PONG, OTHER_FILE), 'moved\n');
  const alsoChanged = row(page, 'Changes', OTHER_FILE);
  await expect(alsoChanged).toBeVisible();
  await group(page, 'Changes').getByText('Changes', { exact: true }).click();
  await expect(changed).toHaveAttribute('aria-selected', 'true');
  await expect(alsoChanged).toHaveAttribute('aria-selected', 'true');
  await alsoChanged.click({ modifiers: ['Control'] });
  await expect(alsoChanged).toHaveAttribute('aria-selected', 'false');
  await alsoChanged.click({ modifiers: ['Control'] });
  await rollBack.click();
  await expect(page.getByRole('heading', { name: 'Rollback the 2 selected files?' })).toBeVisible();
  await page.getByRole('button', { name: 'Rollback', exact: true }).last().click();
  await expect(changed).toHaveCount(0);
  await expect(alsoChanged).toHaveCount(0);
  expect(readFileSync(join(PONG, FILE), 'utf8')).toBe(original);
  expect(readFileSync(join(PONG, OTHER_FILE), 'utf8')).toBe(otherOriginal);
  writeFileSync(join(PONG, FILE), 'again\n');
  await changed.click();
  await page.keyboard.press('Space');
  await expect(changed.getByRole('checkbox')).not.toBeChecked();
  await page.keyboard.press('Space');
  await expect(changed.getByRole('checkbox')).toBeChecked();
  await changed.click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: /^Show Diff/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /^Jump to Source/ })).toBeVisible();
  await page.getByRole('menuitem', { name: /^Rollback…/ }).click();
  await expect(page.getByRole('heading', { name: `Rollback ${FILE}?` })).toBeVisible();
  await page.getByRole('button', { name: 'Rollback', exact: true }).last().click();
  await expect(changed).toHaveCount(0);
  writeFileSync(join(PONG, NEW_FILE), 'new\n');
  await row(page, 'Unversioned Files', NEW_FILE).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Add to VCS' }).click();
  await expect(row(page, 'Changes', NEW_FILE)).toBeVisible();
  await row(page, 'Changes', NEW_FILE).click();
  await rollBack.click();
  await page.getByRole('button', { name: 'Rollback', exact: true }).last().click();
  await row(page, 'Unversioned Files', NEW_FILE).click();
  await page.keyboard.press('Delete');
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
  await expect(row(page, 'Unversioned Files', NEW_FILE)).toHaveCount(0);

  await vcs(page, 'New branch…');
  await page.getByRole('textbox', { name: 'Branch name' }).fill('feature');
  await page.getByRole('button', { name: 'Create branch' }).click();
  await expect(branchStatus(page, 'feature')).toBeVisible();
  const local = logPanel(page).getByRole('list', { name: 'Local branches' });
  await local.getByRole('button', { name: 'main', exact: true }).dblclick();
  await expect(branchStatus(page, 'main')).toBeVisible();
  await local.getByRole('button', { name: 'feature', exact: true }).click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: "New Branch from 'feature'…" })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
  await expect(local.getByRole('button', { name: 'feature', exact: true })).toHaveCount(0);

  git(WORKSPACE, 'init', '--quiet', '--bare', '-b', 'main', REMOTE);
  git(PONG, 'remote', 'add', 'origin', REMOTE);
  const shown = logPanel(page).getByRole('status', { name: 'Branch shown' });
  await vcs(page, 'Push…');
  const pushDialog = await push();
  await expect(pushDialog).toContainText('main → origin/main');
  await expect(pushDialog.getByRole('list', { name: 'Commits to push' })).toContainText(
    'first commit',
  );
  await pushDialog.getByRole('button', { name: 'Push', exact: true }).click();
  await expect(shown).toHaveText('Branch: main ↑0 ↓0');
  git(WORKSPACE, 'clone', '--quiet', REMOTE, OTHER);
  git(OTHER, 'config', 'user.name', 'Other');
  git(OTHER, 'config', 'user.email', 'other@example.com');
  writeFileSync(join(OTHER, FILE), 'theirs\n');
  git(OTHER, 'commit', '--quiet', '-am', 'their change');
  git(OTHER, 'push', '--quiet');
  await logPanel(page).getByRole('button', { name: 'Fetch All Remotes' }).click();
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
  await expect(changed).toBeVisible();
  await commit(page, 'my change');
  await expect(branchStatus(page, 'main ↑1 ↓1')).toBeVisible();
  await vcs(page, 'Update project');
  await expect(page.getByText('The update stopped on conflicts').last()).toBeVisible();
  const conflict = row(page, 'Merge Conflicts', FILE);
  await expect(conflict).toBeVisible();
  writeFileSync(join(PONG, FILE), 'both\n');
  await conflict.getByRole('button', { name: 'Mark resolved' }).click();
  await expect(group(page, 'Merge Conflicts')).toHaveCount(0);
  await commit(page, 'merge', 'Commit and Push…');
  const afterMerge = await push();
  await expect(afterMerge.getByRole('list', { name: 'Commits to push' })).toContainText('merge');
  await afterMerge.getByRole('button', { name: 'Push', exact: true }).click();
  await expect(branchStatus(page, 'main')).toBeVisible();
  await expect(commits(page).getByRole('row').first()).toContainText('merge');

  writeFileSync(join(PONG, FILE), 'both, amended\n');
  await expect(changed).toBeVisible();
  await commitPanel(page).getByRole('checkbox', { name: 'Amend' }).check();
  await expect(message(page)).toHaveValue('merge');
  await commit(page, 'merge, amended');
  await expect(commits(page).getByRole('row').first()).toContainText('merge, amended');
  await expect(changed).toHaveCount(0);
  await commitPanel(page).getByRole('button', { name: 'Commit Message History' }).click();
  await page.getByRole('menuitem', { name: 'my change' }).click();
  await expect(message(page)).toHaveValue('my change');
  await message(page).fill('');

  writeFileSync(join(PONG, FILE), 'work in progress\n');
  await expect(changed).toBeVisible();
  await vcs(page, 'Stash changes…');
  await page.getByRole('textbox', { name: 'Message (optional)' }).fill('wip');
  await page.getByRole('button', { name: 'Stash', exact: true }).click();
  await expect(changed).toHaveCount(0);
  expect(readFileSync(join(PONG, FILE), 'utf8')).toBe('both, amended\n');
  await commitPanel(page)
    .getByRole('tab', { name: /^Stash/ })
    .click();
  const stashed = commitPanel(page).getByRole('listitem', { name: 'On main: wip' });
  await stashed.getByRole('button', { name: 'Pop' }).click();
  await expect(commitPanel(page).getByText('No stash.')).toBeVisible();
  expect(readFileSync(join(PONG, FILE), 'utf8')).toBe('work in progress\n');

  await showPanel(page, 'Files');
  await showPanel(page, 'Console');
  await page.waitForTimeout(900);
});
