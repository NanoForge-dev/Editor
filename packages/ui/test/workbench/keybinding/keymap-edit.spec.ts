import { describe, expect, it } from 'vitest';

import {
  type KeymapLayers,
  isActionChanged,
  resetAction,
  resolveLayers,
  setShortcut,
} from '../../../src/workbench/keybinding/keymap-edit';
import type { KeymapOverride } from '../../../src/workbench/keybinding/keymap.type';

const layers = (patch: Partial<KeymapLayers> = {}): KeymapLayers => ({
  defaults: [
    { key: 'Mod+S', command: 'save', args: [] },
    { key: 'F5', command: 'play', args: [], when: '!playing' },
  ],
  preset: [],
  before: [],
  own: [],
  after: [],
  ...patch,
});

const keys = (value: KeymapLayers) =>
  resolveLayers(value).map(
    (binding) =>
      `${binding.source}:${binding.command}:${binding.strokes.join(' ')}${binding.when ? `:${binding.when}` : ''}`,
  );

/** Applies an edit to the edited scope and returns the layers with it. */
const edit = (value: KeymapLayers, own: KeymapOverride[]): KeymapLayers => ({ ...value, own });

describe('setShortcut', () => {
  it('adds a shortcut, a chord too, and several per action', () => {
    let value = layers();
    value = edit(value, setShortcut(value, { command: 'save', key: 'Mod+K Mod+S' }, {}));
    value = edit(value, setShortcut(value, { command: 'save', key: 'F2' }, { when: 'editing' }));
    expect(value.own).toEqual([
      { command: 'save', key: 'Mod+K Mod+S' },
      { command: 'save', key: 'F2', when: 'editing' },
    ]);
    expect(keys(value)).toContain('user:save:Ctrl+K Ctrl+S');
    expect(keys(value)).toContain('default:save:Ctrl+S');
  });

  it('removes a default with one entry, and puts it back with none', () => {
    let value = layers();
    value = edit(value, setShortcut(value, { command: 'save', key: 'Mod+S' }, undefined));
    expect(value.own).toEqual([{ command: 'save', key: 'Mod+S', remove: true }]);
    expect(keys(value)).toEqual(['default:play:F5:!playing']);
    value = edit(value, setShortcut(value, { command: 'save', key: 'Ctrl+S' }, {}));
    expect(value.own).toEqual([]);
  });

  it('removes a shortcut the user added by dropping its entry', () => {
    let value = layers({ own: [{ command: 'save', key: 'F2' }] });
    value = edit(value, setShortcut(value, { command: 'save', key: 'F2' }, undefined));
    expect(value.own).toEqual([]);
  });

  it('changes the condition of a default: a removal, then the new shortcut', () => {
    let value = layers();
    value = edit(value, setShortcut(value, { command: 'play', key: 'F5' }, { when: 'ready' }));
    expect(value.own).toEqual([
      { command: 'play', key: 'F5', remove: true },
      { command: 'play', key: 'F5', when: 'ready' },
    ]);
    expect(keys(value)).toEqual(['user:play:F5:ready', 'default:save:Ctrl+S']);
    value = edit(value, setShortcut(value, { command: 'play', key: 'F5' }, { when: '!playing' }));
    expect(value.own).toEqual([]);
  });

  it('keeps arguments, and tells actions with different arguments apart', () => {
    let value = layers();
    const game = { command: 'open', args: ['game'], key: 'Ctrl+F2' };
    value = edit(value, setShortcut(value, game, {}));
    value = edit(
      value,
      setShortcut(value, { command: 'open', args: ['scene'], key: 'Ctrl+F2' }, {}),
    );
    expect(value.own).toHaveLength(2);
    value = edit(value, setShortcut(value, game, undefined));
    expect(value.own).toEqual([{ command: 'open', key: 'Ctrl+F2', args: ['scene'] }]);
  });

  it('edits one scope on top of the other', () => {
    const account: KeymapOverride[] = [
      { command: 'save', key: 'F2' },
      { command: 'save', key: 'Mod+S', remove: true },
    ];
    let machine = layers({ before: account });
    machine = edit(machine, setShortcut(machine, { command: 'save', key: 'F2' }, undefined));
    machine = edit(machine, setShortcut(machine, { command: 'save', key: 'Mod+S' }, {}));
    expect(machine.own).toEqual([
      { command: 'save', key: 'F2', remove: true },
      { command: 'save', key: 'Mod+S' },
    ]);
    expect(keys(machine)).toEqual(['user:save:Ctrl+S', 'default:play:F5:!playing']);
    const edited = layers({ own: account, after: machine.own });
    expect(setShortcut(edited, { command: 'play', key: 'F9' }, {})).toEqual([
      ...account,
      { command: 'play', key: 'F9' },
    ]);
  });

  it('works on top of a preset', () => {
    let value = layers({ preset: [{ command: 'play', key: 'F6' }] });
    value = edit(value, setShortcut(value, { command: 'play', key: 'F6' }, undefined));
    expect(value.own).toEqual([{ command: 'play', key: 'F6', remove: true }]);
    expect(keys(value)).not.toContain('preset:play:F6');
  });
});

describe('resetAction', () => {
  it('drops every entry about the action and nothing else', () => {
    const own: KeymapOverride[] = [
      { command: 'save', key: 'F2' },
      { command: 'save', key: 'Mod+S', remove: true },
      { command: 'play', key: 'F9' },
      { command: 'open', key: 'F1', args: ['game'] },
    ];
    expect(resetAction(own, 'save')).toEqual([own[2], own[3]]);
    expect(resetAction(own, 'open', ['scene'])).toEqual(own);
    expect(isActionChanged(own, 'save')).toBe(true);
    expect(isActionChanged(own, 'open')).toBe(false);
    expect(isActionChanged(own, 'open', ['game'])).toBe(true);
  });
});
