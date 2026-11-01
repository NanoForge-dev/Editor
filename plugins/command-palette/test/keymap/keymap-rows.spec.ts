import { describe, expect, it, vi } from 'vitest';

import type { EditorAction, ResolvedKeybinding } from '@nanoforge-dev/editor-sdk/ui';

import {
  conflictsOf,
  filterRows,
  keymapRows,
  strokesOf,
  userConflicts,
} from '../../src/keymap/keymap-rows';

vi.mock('@nanoforge-dev/editor-sdk/ui', () => ({
  actionId: (command: string, args: readonly unknown[]) =>
    args.length ? `${command}:${JSON.stringify(args)}` : command,
  actionLabel: (action: { title: string; category?: string }) =>
    action.category ? `${action.category}: ${action.title}` : action.title,
  bindingsConflict: (a: ResolvedKeybinding, b: ResolvedKeybinding) =>
    a.key === b.key && a.command !== b.command,
  findConflicts: (bindings: readonly ResolvedKeybinding[]) =>
    [...Map.groupBy(bindings, (binding) => binding.key).values()]
      .filter((group) => group.length > 1)
      .map((group) => ({ bindings: group })),
  formatKeybinding: (key: string) => key.replace('Mod', 'Ctrl'),
  isActionChanged: (overrides: readonly { command: string }[], command: string) =>
    overrides.some((override) => override.command === command),
  parseKeybinding: (key: string) => {
    if (!key.trim()) throw new Error('empty');
    return key.split(' ');
  },
}));

const action = (command: string, title: string, category?: string): EditorAction => ({
  id: command,
  command,
  args: [],
  title,
  ...(category && { category }),
  when: [],
});

const binding = (
  command: string,
  key: string,
  source: ResolvedKeybinding['source'] = 'default',
): ResolvedKeybinding => ({ command, args: [], key, strokes: key.split(' '), source });

const SAVE = action('file.save', 'Save', 'File');
const PLAY = action('run.play', 'Play', 'Run');
const BINDINGS = [binding('file.save', 'Mod+S'), binding('editor.hidden', 'Mod+H')];
const LAYERS = { before: [], own: [{ command: 'run.play' }], after: [] } as never;

describe('keymap rows', () => {
  it('lists every action, and the untitled commands that have shortcuts', () => {
    const rows = keymapRows([SAVE, PLAY], LAYERS, BINDINGS, new Set());
    expect(rows.map((row) => [row.label, row.bindings.length, row.changed])).toEqual([
      ['File: Save', 1, false],
      ['Run: Play', 0, true],
      ['editor.hidden', 1, false],
    ]);
  });

  it('marks the actions whose shortcuts conflict with a change of the user', () => {
    const mine = binding('run.play', 'Mod+S', 'user');
    const bindings = [...BINDINGS, mine];
    const conflicting = userConflicts(bindings);
    expect(conflicting).toEqual(new Set([BINDINGS[0], mine]));
    expect(userConflicts(BINDINGS)).toEqual(new Set());
    const rows = keymapRows([SAVE, PLAY], LAYERS, bindings, conflicting);
    expect(rows.filter((row) => row.conflict).map((row) => row.action.id)).toEqual([
      'file.save',
      'run.play',
    ]);
  });

  it('filters by label, command, shortcut, changes and conflicts', () => {
    const rows = keymapRows([SAVE, PLAY], LAYERS, BINDINGS, new Set([BINDINGS[0]!]));
    const ids = (query: string, onlyChanged = false, onlyConflicts = false) =>
      filterRows(rows, { query, onlyChanged, onlyConflicts }).map((row) => row.action.id);
    expect(ids('  SAVE ')).toEqual(['file.save']);
    expect(ids('run.')).toEqual(['run.play']);
    expect(ids('ctrl+h')).toEqual(['editor.hidden']);
    expect(ids('mod+s')).toEqual(['file.save']);
    expect(ids('', true)).toEqual(['run.play']);
    expect(ids('', false, true)).toEqual(['file.save']);
    expect(ids('nothing')).toEqual([]);
  });

  it('parses strokes, and finds what a candidate shortcut would get in the way of', () => {
    expect(strokesOf('Mod+K S')).toEqual(['Mod+K', 'S']);
    expect(strokesOf(' ')).toBeUndefined();
    expect(conflictsOf(BINDINGS, PLAY, 'Mod+S', undefined)).toEqual([BINDINGS[0]]);
    expect(conflictsOf(BINDINGS, PLAY, 'Mod+S', 'editorFocus', BINDINGS[0])).toEqual([]);
    expect(conflictsOf(BINDINGS, PLAY, ' ', undefined)).toEqual([]);
  });
});
