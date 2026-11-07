import { describe, expect, it } from 'vitest';

import { type PathChange, pairRenames } from '../../src/service/pair-renames';

const file = (type: PathChange['type'], path: string): PathChange => ({ type, path, kind: 'file' });

describe('pairRenames', () => {
  it('pairs a rename in place and a move to another folder', () => {
    expect([
      ...pairRenames([file('deleted', 'src/notes.md'), file('created', 'src/todo.md')]),
    ]).toEqual([['src/notes.md', 'src/todo.md']]);
    expect([
      ...pairRenames([file('created', 'docs/notes.md'), file('deleted', 'src/notes.md')]),
    ]).toEqual([['src/notes.md', 'docs/notes.md']]);
  });

  it('follows the files of a renamed folder', () => {
    const pairs = pairRenames([
      { type: 'deleted', path: 'old', kind: 'directory' },
      { type: 'created', path: 'new', kind: 'directory' },
      file('deleted', 'old/a/index.ts'),
      file('deleted', 'old/b/index.ts'),
      file('created', 'new/a/index.ts'),
      file('created', 'new/b/index.ts'),
    ]);
    expect(Object.fromEntries(pairs)).toEqual({
      'old/a/index.ts': 'new/a/index.ts',
      'old/b/index.ts': 'new/b/index.ts',
    });
  });

  it('leaves a plain deletion, and an unclear batch, alone', () => {
    expect(pairRenames([file('deleted', 'src/a.ts')]).size).toBe(0);
    expect(pairRenames([file('deleted', 'src/a.ts'), file('created', 'src/a.ts')]).size).toBe(0);
    expect(pairRenames([file('deleted', 'src/a.ts'), file('changed', 'src/b.ts')]).size).toBe(0);
    expect(
      pairRenames([
        file('deleted', 'src/a.ts'),
        file('deleted', 'src/b.ts'),
        file('created', 'src/c.ts'),
        file('created', 'src/d.ts'),
      ]).size,
    ).toBe(0);
  });
});
