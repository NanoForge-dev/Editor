import { describe, expect, it } from 'vitest';

import { FileFilter, fuzzyScore, isPackagePath } from '../../src/filter/file-filter';

describe('FileFilter', () => {
  it('hides what gitignore patterns match, folders by their trailing slash', () => {
    const filter = new FileFilter(['*.log', 'build/', '.*']);
    expect(filter.excludes({ path: 'logs/run.log', kind: 'file' })).toBe(true);
    expect(filter.excludes({ path: 'build', kind: 'directory' })).toBe(true);
    expect(filter.excludes({ path: 'build', kind: 'file' })).toBe(false);
    expect(filter.excludes({ path: 'src/.env', kind: 'file' })).toBe(true);
    expect(filter.excludes({ path: 'src/main.ts', kind: 'file' })).toBe(false);
  });
});

describe('isPackagePath', () => {
  it('is nf_modules and what it holds, not a name that starts the same', () => {
    expect(isPackagePath('nf_modules')).toBe(true);
    expect(isPackagePath('nf_modules/@acme/ball/manifest.json')).toBe(true);
    expect(isPackagePath('nf_modules2/x')).toBe(false);
    expect(isPackagePath('src/nf_modules')).toBe(false);
  });
});

describe('fuzzyScore', () => {
  it('matches the characters of the query in order, on the file name only', () => {
    expect(fuzzyScore('mts', 'src/main.ts')).toBeGreaterThan(0);
    expect(fuzzyScore('MAIN', 'src/main.ts')).toBeGreaterThan(0);
    expect(fuzzyScore('src', 'src/main.ts')).toBe(-1);
    expect(fuzzyScore('nm', 'src/main.ts')).toBe(-1);
    expect(fuzzyScore('', 'src/main.ts')).toBe(0);
  });

  it('ranks consecutive and early matches first, then shorter names', () => {
    expect(fuzzyScore('main', 'main.ts')).toBeGreaterThan(fuzzyScore('main', 'my-animation.ts'));
    expect(fuzzyScore('ma', 'main.ts')).toBeGreaterThan(fuzzyScore('ma', 'xmain.ts'));
    expect(fuzzyScore('main', 'main.ts')).toBeGreaterThan(fuzzyScore('main', 'main-menu.ts'));
  });
});
