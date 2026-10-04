import { describe, expect, it } from 'vitest';

import { changeGroups, nextChecked } from '../../src/model/change-groups';
import { status } from '../fixtures/status';

describe('changeGroups', () => {
  it('lists conflicts, changes and unversioned files, with name and folder', () => {
    const groups = changeGroups(status());
    const names = (rows: { letter: string; file: { path: string } }[]) =>
      rows.map((row) => `${row.letter} ${row.file.path}`);
    expect(names(groups.conflicts)).toEqual(['C src/deep/both.ts']);
    expect(names(groups.changes)).toEqual(['M a.txt', 'D src/gone.ts', 'R moved.ts']);
    expect(names(groups.unversioned)).toEqual(['U src/new.ts']);
    expect(groups.changes[2]!.title).toBe('Renamed (was old.ts)');
    expect(groups.changes[1]).toMatchObject({ name: 'gone.ts', folder: 'src' });
    expect(groups.changes[0]).toMatchObject({ name: 'a.txt', folder: '' });
    const folder = changeGroups({
      files: [{ path: 'deps/lib/', unstaged: 'U', conflicted: false }],
    });
    expect(folder.unversioned[0]).toMatchObject({ name: 'lib/', folder: 'deps' });
  });
});

describe('nextChecked', () => {
  it('checks new changes for the commit, not new unversioned files, and keeps choices', () => {
    const groups = changeGroups(status());
    const first = nextChecked(new Set(), new Set(), groups);
    expect([...first].sort()).toEqual(['a.txt', 'moved.ts', 'src/gone.ts']);
    const known = new Set(['a.txt', 'moved.ts', 'src/gone.ts', 'src/new.ts']);
    const chosen = new Set(['moved.ts', 'src/gone.ts', 'src/new.ts']);
    expect([...nextChecked(chosen, known, groups)].sort()).toEqual([
      'moved.ts',
      'src/gone.ts',
      'src/new.ts',
    ]);
    expect(nextChecked(chosen, known, changeGroups({ files: [] })).size).toBe(0);
  });
});
