import { describe, expect, it, vi } from 'vitest';

import type { EditorAction } from '@nanoforge-dev/editor-sdk/ui';

import {
  listedFiles,
  parseLine,
  parseQuery,
  pushRecent,
  rankActions,
  rankFiles,
  rankSymbols,
} from '../../src/palette/palette-model';
import { readRecent, rememberRecent } from '../../src/palette/recent';

vi.mock('@nanoforge-dev/editor-sdk/ui', () => ({
  actionLabel: (action: { title: string; category?: string }) =>
    action.category ? `${action.category}: ${action.title}` : action.title,
}));

const action = (id: string, title: string, category?: string): EditorAction => ({
  id,
  command: id,
  args: [],
  title,
  ...(category && { category }),
  when: [],
});

const ACTIONS = [
  action('runtime.play', 'Play', 'Run'),
  action('runtime.stop', 'Stop', 'Run'),
  action('layout.reset', 'Reset layout', 'View'),
  action('console.clear', 'Clear the console', 'Console'),
];

describe('query', () => {
  it('picks the mode from the first character', () => {
    expect(parseQuery('>stop')).toEqual({ mode: 'commands', text: 'stop' });
    expect(parseQuery('main.ts')).toEqual({ mode: 'files', text: 'main.ts' });
    expect(parseQuery(':12')).toEqual({ mode: 'line', text: '12' });
    expect(parseQuery('@ update')).toEqual({ mode: 'symbols', text: 'update' });
    expect(parseQuery('')).toEqual({ mode: 'files', text: '' });
  });

  it('reads a line and an optional column', () => {
    expect(parseLine('12')).toEqual({ line: 12, column: 1 });
    expect(parseLine('12:4')).toEqual({ line: 12, column: 4 });
    expect(parseLine(' 7 , 2 ')).toEqual({ line: 7, column: 2 });
    expect(parseLine('0')).toBeUndefined();
    expect(parseLine('abc')).toBeUndefined();
    expect(parseLine('')).toBeUndefined();
  });
});

describe('ranking', () => {
  it('lists recent actions first when nothing is typed', () => {
    const ids = (recent: string[]) =>
      rankActions(ACTIONS, '', recent).map((entry) => entry.item.id);
    expect(ids([])).toEqual(['runtime.play', 'runtime.stop', 'layout.reset', 'console.clear']);
    expect(ids(['console.clear', 'runtime.stop'])).toEqual([
      'console.clear',
      'runtime.stop',
      'runtime.play',
      'layout.reset',
    ]);
  });

  it('searches the category and the title, the best match first', () => {
    expect(rankActions(ACTIONS, 'stop', []).map((entry) => entry.label)).toEqual(['Run: Stop']);
    expect(rankActions(ACTIONS, 'rese', [])[0]!.label).toBe('View: Reset layout');
    expect(rankActions(ACTIONS, 'zzz', [])).toEqual([]);
  });

  it('lets a recent action win a tie', () => {
    const twins = [action('a.one', 'Open thing'), action('b.two', 'Open thing')];
    expect(rankActions(twins, 'open', ['b.two'])[0]!.item.id).toBe('b.two');
  });

  it('leaves dependency and build folders out of the files, open documents first', () => {
    const files = listedFiles([
      'apps/client/src/main.ts',
      'node_modules/x/index.js',
      'apps/client/dist/main.js',
      '.nanoforge/editor/settings.json',
      'README.md',
    ]);
    expect(files).toEqual(['apps/client/src/main.ts', 'README.md']);
    expect(rankFiles(files, '', ['README.md']).map((entry) => entry.item)).toEqual([
      'README.md',
      'apps/client/src/main.ts',
    ]);
    expect(rankFiles(files, 'mts', [])[0]!.item).toBe('apps/client/src/main.ts');
  });

  it('keeps symbols in source order when nothing is typed, and searches containers', () => {
    const symbols = [
      { name: 'Position', kind: 'class', line: 1, column: 1 },
      { name: 'move', kind: 'method', container: 'Position', line: 3, column: 3 },
      { name: 'update', kind: 'function', line: 9, column: 1 },
    ];
    expect(rankSymbols(symbols, '').map((entry) => entry.label)).toEqual([
      'Position',
      'Position.move',
      'update',
    ]);
    expect(rankSymbols(symbols, 'pmove')[0]!.label).toBe('Position.move');
  });
});

describe('recent actions', () => {
  it('keeps the last ones, the newest first, without doubles', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
    expect(pushRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
  });

  it('survives a broken or blocked storage', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
    rememberRecent('a', storage);
    rememberRecent('b', storage);
    expect(readRecent(storage)).toEqual(['b', 'a']);
    values.set([...values.keys()][0]!, '{not json');
    expect(readRecent(storage)).toEqual([]);
    expect(() =>
      rememberRecent('c', {
        getItem: () => null,
        setItem: () => {
          throw new Error('quota');
        },
      }),
    ).not.toThrow();
  });
});
