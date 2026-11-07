import { describe, expect, it } from 'vitest';

import type { CodeDiagnostic } from '@nanoforge-dev/editor-sdk';

import { groupProblems, origin, positionAt, summary } from '../../src/problems/group-problems';

const problem = (patch: Partial<CodeDiagnostic>): CodeDiagnostic => ({
  path: 'src/a.ts',
  start: 0,
  length: 1,
  message: 'Type mismatch',
  severity: 'error',
  source: 'typescript',
  ...patch,
});

const ALL = new Map<string, CodeDiagnostic[]>([
  ['src/b.ts', [problem({ path: 'src/b.ts', severity: 'warning', message: 'Unused' })]],
  ['src/a.ts', [problem({ code: 2322 }), problem({ severity: 'info', message: 'Hint' })]],
  ['', [problem({ path: '', source: 'build:apps/client', message: 'Build of Client failed' })]],
]);
const EVERY = { error: true, warning: true, info: true };

describe('problems', () => {
  it('groups by file in order, problems without a file under their source first', () => {
    const groups = groupProblems(ALL, { severities: EVERY, query: '' });
    expect(groups.map((group) => [group.label, group.path, group.errors, group.warnings])).toEqual([
      ['Build of apps/client', undefined, 1, 0],
      ['src/a.ts', 'src/a.ts', 1, 0],
      ['src/b.ts', 'src/b.ts', 0, 1],
    ]);
  });

  it('filters by severity and text', () => {
    const errors = groupProblems(ALL, {
      severities: { error: true, warning: false, info: false },
      query: '',
    });
    expect(errors.map((group) => group.problems.length)).toEqual([1, 1]);
    expect(
      groupProblems(ALL, { severities: EVERY, query: 'UNUSED' }).map((group) => group.label),
    ).toEqual(['src/b.ts']);
    expect(
      groupProblems(ALL, { severities: EVERY, query: '2322' }).map((group) => group.label),
    ).toEqual(['src/a.ts']);
  });

  it('summarizes for the status bar', () => {
    expect(summary(ALL)).toBe('2 errors · 1 warning');
    expect(summary(new Map())).toBe('No problems');
    expect(summary(new Map([['a', [problem({})]]]))).toBe('1 error');
  });

  it('names where a problem comes from, and finds positions from offsets', () => {
    expect(origin(problem({ code: 2322 }))).toBe('typescript 2322');
    expect(origin(problem({ source: 'build:apps/client' }))).toBe('build');
    expect(positionAt('ab\ncd\nef', 4)).toEqual({ line: 2, column: 2 });
    expect(positionAt('ab', 0)).toEqual({ line: 1, column: 1 });
  });
});
