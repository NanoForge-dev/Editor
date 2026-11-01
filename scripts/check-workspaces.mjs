#!/usr/bin/env node
/**
 * Checks every workspace against the repository's standards (after the engine's): the order of
 * its package.json fields, its files, its label in the three label files and its choice in the
 * issue forms. Workspaces come from pnpm-workspace.yaml, never from a folder scan. Run by
 * `pnpm lint`; exits 1 and names each problem.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAIN = process.argv[1] === fileURLToPath(import.meta.url);
/** The repository, or the folder given to the script (to check a copy). */
const ROOT = (MAIN && process.argv[2]) || join(dirname(fileURLToPath(import.meta.url)), '..');

/** The engine's order of package.json fields. */
const FIELDS = [
  '$schema',
  'name',
  'version',
  'description',
  'keywords',
  'homepage',
  'bugs',
  'license',
  'contributors',
  'files',
  'main',
  'module',
  'types',
  'exports',
  'type',
  'directories',
  'repository',
  'funding',
  'scripts',
  'dependencies',
  'peerDependencies',
  'devDependencies',
  'packageManager',
  'engines',
  'private',
  'publishConfig',
  'lint-staged',
];
const REQUIRED = ['README.md', 'LICENSE', '.prettierignore'];
/** Published workspaces also keep a changelog and its release config. */
const PUBLISHED = new Set(['apps/editor', 'packages/sdk', 'tooling/vite-plugin']);
const RELEASE = ['CHANGELOG.md', 'cliff.toml', '.cliff-jumperrc.json'];
const DEPENDENCIES = ['dependencies', 'peerDependencies', 'devDependencies'];
/** Issue forms and the workspace groups they offer. */
const FORMS = {
  '01-packages_bug_report.yml': ['apps', 'packages', 'plugins'],
  '03-feature_request.yml': ['apps', 'packages', 'plugins'],
  '02-tooling_bug_report.yml': ['tooling'],
};

const read = (path) => readFileSync(join(ROOT, path), 'utf8');

/** `apps/*`-style globs of pnpm-workspace.yaml. */
export const workspaceGlobs = (yaml) => {
  const block = /^packages:\n((?:\s+-\s+.+\n?)+)/m.exec(yaml)?.[1] ?? '';
  return [...block.matchAll(/-\s+['"]?([^'"\n]+)['"]?/g)].map((match) => match[1].trim());
};

export const workspaces = () =>
  workspaceGlobs(read('pnpm-workspace.yaml')).flatMap((glob) => {
    if (!glob.endsWith('/*')) return existsSync(join(ROOT, glob, 'package.json')) ? [glob] : [];
    const group = glob.slice(0, -2);
    return readdirSync(join(ROOT, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${group}/${entry.name}`)
      .filter((path) => existsSync(join(ROOT, path, 'package.json')));
  });

/** Problems of one package.json: fields out of the engine's order, unsorted dependencies. */
export const manifestProblems = (manifest) => {
  const problems = [];
  const keys = Object.keys(manifest);
  const unknown = keys.filter((key) => !FIELDS.includes(key));
  if (unknown.length)
    problems.push(`package.json has fields the engine has not: ${unknown.join(', ')}`);
  const known = keys.filter((key) => FIELDS.includes(key));
  const expected = [...known].sort((a, b) => FIELDS.indexOf(a) - FIELDS.indexOf(b));
  const at = known.findIndex((key, index) => key !== expected[index]);
  if (at !== -1)
    problems.push(
      `package.json field "${known[at]}" is out of order (expected "${expected[at]}" there)`,
    );
  for (const field of DEPENDENCIES) {
    const names = Object.keys(manifest[field] ?? {});
    const sorted = [...names].sort();
    if (names.join() !== sorted.join()) problems.push(`package.json ${field} are not sorted`);
  }
  return problems;
};

const labelsOf = {
  'labels.yml': (text) => new Set([...text.matchAll(/^- name: '([^']+)'/gm)].map((m) => m[1])),
  'labeler.yml': (text) => new Set([...text.matchAll(/^([\w-]+:[\w-]+):$/gm)].map((m) => m[1])),
  'issue-labeler.yml': (text) =>
    new Set([...text.matchAll(/^([\w-]+:[\w-]+):$/gm)].map((m) => m[1])),
};

/** The choices of the first dropdown of an issue form. */
const formChoices = (text) => {
  const block = /options:\n((?:\s+- .+\n)+)/.exec(text)?.[1] ?? '';
  return new Set([...block.matchAll(/- (.+)/g)].map((m) => m[1].trim()));
};

export const check = () => {
  const problems = [];
  const labels = Object.fromEntries(
    Object.entries(labelsOf).map(([file, parse]) => [file, parse(read(`.github/${file}`))]),
  );
  const forms = Object.fromEntries(
    Object.keys(FORMS).map((file) => [file, formChoices(read(`.github/ISSUE_TEMPLATE/${file}`))]),
  );
  for (const path of workspaces()) {
    const report = (message) => problems.push(`${path}: ${message}`);
    const [group, name] = path.split('/');
    for (const message of manifestProblems(JSON.parse(read(`${path}/package.json`))))
      report(message);
    const files = PUBLISHED.has(path) ? [...REQUIRED, ...RELEASE] : REQUIRED;
    for (const file of files) if (!existsSync(join(ROOT, path, file))) report(`has no ${file}`);
    const label = `${group}:${name}`;
    for (const [file, names] of Object.entries(labels))
      if (!names.has(label)) report(`has no "${label}" label in .github/${file}`);
    for (const [file, groups] of Object.entries(FORMS))
      if (groups.includes(group) && !forms[file].has(name))
        report(`is not a choice of .github/ISSUE_TEMPLATE/${file}`);
  }
  return problems;
};

if (MAIN) {
  const problems = check();
  for (const problem of problems) console.error(`✖ ${problem}`);
  if (problems.length) {
    console.error(
      `\n${problems.length} problem(s) in the workspaces (scripts/check-workspaces.mjs)`,
    );
    process.exit(1);
  }
  console.log(`✓ ${workspaces().length} workspaces follow the repository's standards`);
}
