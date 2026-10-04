import { describe, expect, it } from 'vitest';

import { fuzzyMatch, highlight } from '../../src/palette/fuzzy';

const rank = (query: string, texts: string[]) =>
  texts
    .map((text) => ({ text, match: fuzzyMatch(query, text) }))
    .filter((entry) => entry.match)
    .sort((a, b) => b.match!.score - a.match!.score)
    .map((entry) => entry.text);

describe('fuzzyMatch', () => {
  it('matches letters in order, ignoring case and spaces', () => {
    expect(fuzzyMatch('rst', 'Run: Stop')).toBeDefined();
    expect(fuzzyMatch('run stop', 'Run: Stop')).toBeDefined();
    expect(fuzzyMatch('tsr', 'Run: Stop')).toBeUndefined();
    expect(fuzzyMatch('', 'anything')).toEqual({ score: 0, ranges: [] });
    expect(fuzzyMatch('longer than the text', 'short')).toBeUndefined();
  });

  it('ranks word starts and runs above scattered letters', () => {
    expect(rank('cp', ['Copy path', 'Close panel', 'Escape'])).toEqual([
      'Copy path',
      'Close panel',
      'Escape',
    ]);
    expect(rank('stop', ['Run: Stop', 'Set top dock position'])[0]).toBe('Run: Stop');
    expect(rank('main', ['apps/client/src/main.ts', 'apps/client/domain/index.ts'])[0]).toBe(
      'apps/client/src/main.ts',
    );
    expect(rank('om', ['fileManager.open', 'openMenu'])[0]).toBe('openMenu');
  });

  it('prefers the shorter of two equal matches', () => {
    expect(rank('save', ['File: Save all', 'File: Save'])[0]).toBe('File: Save');
  });

  it('gives the matched ranges, merged', () => {
    expect(fuzzyMatch('rust', 'Run: Stop')!.ranges).toEqual([
      [0, 2],
      [5, 7],
    ]);
    expect(
      highlight('Run: Stop', [
        [0, 2],
        [5, 7],
      ]),
    ).toEqual([
      { text: 'Ru', match: true },
      { text: 'n: ', match: false },
      { text: 'St', match: true },
      { text: 'op', match: false },
    ]);
  });
});
