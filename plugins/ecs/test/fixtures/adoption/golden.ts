import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { expect } from 'vitest';

import { CodeEngine } from '@nanoforge-dev/editor-code/engine';

export const FIXTURES = import.meta.dirname;

/** Every file of a folder, by path relative to it. */
export const readTree = (root: string): Map<string, string> => {
  const files = new Map<string, string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.set(relative(root, path), readFileSync(path, 'utf8'));
    }
  };
  walk(root);
  return files;
};

/** A code engine on a fixture's `input` tree. */
export const engineOf = (files: Map<string, string>): CodeEngine => {
  const engine = new CodeEngine();
  engine.setFiles([...files].map(([path, text]) => ({ path, text })));
  return engine;
};

/**
 * Compares a tree with the fixture's `expected` folder; `UPDATE_GOLDEN=1` writes it instead
 * (then read the diff before committing it).
 */
export const expectTree = (fixture: string, files: Map<string, string>): void => {
  const root = join(FIXTURES, fixture, 'expected');
  if (process.env.UPDATE_GOLDEN) {
    rmSync(root, { recursive: true, force: true });
    for (const [path, text] of files) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    return;
  }
  expect(Object.fromEntries([...files].sort())).toEqual(Object.fromEntries([...readTree(root)].sort()));
};
