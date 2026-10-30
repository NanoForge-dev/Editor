import { describe, expect, it } from 'vitest';

import { diffHunks, diffLines } from '../../../src/workbench/changeset/diff-lines';

const kinds = (before?: string, after?: string) =>
  diffLines(before, after).map((line) => `${line.kind}${line.text}`);

describe('diffLines', () => {
  it('keeps common lines and marks the rest removed or added', () => {
    expect(kinds('a\nb\nc\n', 'a\nx\nc\n')).toEqual([' a', '-b', '+x', ' c']);
    expect(kinds(undefined, 'new\nfile\n')).toEqual(['+new', '+file']);
    expect(kinds('gone\n', undefined)).toEqual(['-gone']);
    expect(kinds('same\n', 'same\n')).toEqual([' same']);
  });

  it('numbers lines in each text', () => {
    const lines = diffLines('a\nb\n', 'z\na\nb\n');
    expect(lines[0]).toEqual({ kind: '+', text: 'z', new: 1 });
    expect(lines[1]).toEqual({ kind: ' ', text: 'a', old: 1, new: 2 });
  });

  it('cuts long unchanged runs out of hunks', () => {
    const before = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n');
    const after = before.replace('line 2\n', 'two\n').replace('line 17', 'seventeen');
    const hunks = diffHunks(diffLines(before, after), 1);
    expect(hunks).toHaveLength(2);
    expect(hunks[0]!.lines.map((line) => line.text)).toEqual(['line 1', 'line 2', 'two', 'line 3']);
  });
});
