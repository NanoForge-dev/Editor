import { describe, expect, it } from 'vitest';

import { decorationOf } from '../../src/model/file-decoration';
import { status } from '../fixtures/status';

describe('decorationOf', () => {
  it('marks files and the folders that hold changes', () => {
    const value = status();
    expect(decorationOf(value, 'a.txt', 'file')).toEqual({
      badge: 'M',
      tone: 'modified',
      tooltip: 'Modified',
    });
    expect(decorationOf(value, 'src/new.ts', 'file')).toMatchObject({ badge: 'U', tone: 'added' });
    expect(decorationOf(value, 'src/gone.ts', 'file')).toMatchObject({
      badge: 'D',
      tone: 'deleted',
    });
    expect(decorationOf(value, 'src/deep/both.ts', 'file')).toMatchObject({ badge: 'C' });
    expect(decorationOf(value, 'clean.txt', 'file')).toBeUndefined();
    expect(decorationOf(value, 'src', 'directory')).toEqual({
      badge: '•',
      tone: 'conflict',
      tooltip: '3 changed files inside',
    });
    expect(decorationOf(value, 'sr', 'directory')).toBeUndefined();
    const untracked = status({ files: [{ path: 'deps/', unstaged: 'U', conflicted: false }] });
    expect(decorationOf(untracked, 'deps', 'directory')).toMatchObject({ badge: '•' });
    expect(decorationOf(untracked, 'deps/lib/index.js', 'file')).toMatchObject({ badge: 'U' });
    expect(decorationOf(untracked, 'depsy.js', 'file')).toBeUndefined();
    expect(decorationOf(undefined, 'a.txt', 'file')).toBeUndefined();
  });
});
