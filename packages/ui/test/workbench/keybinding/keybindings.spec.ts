import { describe, expect, it, vi } from 'vitest';

import {
  CommandRegistry,
  Container,
  ContextKeyService,
  ExtensionRegistry,
  ObservableValue,
} from '@nanoforge-dev/editor-kernel';

import { KEYBINDINGS } from '../../../src/workbench/extension-point/keybinding.extension-point';
import { KeybindingService } from '../../../src/workbench/keybinding/keybinding-service';
import type { KeymapOverride } from '../../../src/workbench/keybinding/keymap.type';
import {
  formatKeybinding,
  normalizeStroke,
  parseKeybinding,
  portableStroke,
} from '../../../src/workbench/keybinding/keystroke';
import {
  bindingsConflict,
  findConflicts,
  resolveKeymap,
} from '../../../src/workbench/keybinding/resolve-keymap';

const key = (init: Partial<KeyboardEvent> & { key: string }) =>
  ({
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...init,
  }) as unknown as KeyboardEvent;

const setup = (overrides: KeymapOverride[] = []) => {
  const extensions = new ExtensionRegistry();
  const context = new ContextKeyService();
  const commands = new CommandRegistry(new Container(), context);
  const ran: string[] = [];
  for (const id of ['undo', 'palette', 'save', 'quickOpen', 'other']) {
    commands.register({ id, handler: () => void ran.push(id) });
  }
  const bind = (binding: { key: string; command: string; when?: string }) =>
    extensions.contribute(KEYBINDINGS, { args: [], ...binding }, { owner: 'core' });
  bind({ key: 'Mod+Z', command: 'undo', when: '!textInputFocus' });
  bind({ key: 'Ctrl+Shift+P', command: 'palette' });
  bind({ key: 'Ctrl+K Ctrl+S', command: 'save' });
  bind({ key: 'Ctrl+P', command: 'quickOpen' });
  const service = new KeybindingService(
    extensions,
    commands,
    context,
    new ObservableValue(overrides),
  );
  return { service, context, ran, bind };
};

describe('keybinding parsing', () => {
  it('normalizes strokes', () => {
    expect(normalizeStroke('shift+ctrl+p', false)).toBe('Ctrl+Shift+P');
    expect(normalizeStroke('Mod+Z', true)).toBe('Meta+Z');
    expect(normalizeStroke('Mod+Z', false)).toBe('Ctrl+Z');
    expect(normalizeStroke('Ctrl++', false)).toBe('Ctrl++');
    expect(normalizeStroke('esc', false)).toBe('Escape');
    expect(parseKeybinding('ctrl+k  ctrl+s', false)).toEqual(['Ctrl+K', 'Ctrl+S']);
    expect(formatKeybinding('Mod+Shift+P', true)).toBe('⇧⌘P');
    expect(() => normalizeStroke('Hyper+X', false)).toThrow(/modifier/);
  });
});

describe('KeybindingService', () => {
  it('runs commands and lets native undo work in text inputs', async () => {
    const { service, context, ran } = setup();
    const event = key({ key: 'z', ctrlKey: true });
    expect(service.handle(event)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    context.set('textInputFocus', true);
    const native = key({ key: 'z', ctrlKey: true });
    expect(service.handle(native)).toBe(false);
    expect(native.preventDefault).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(ran).toEqual(['undo']);
  });

  it('uses the typed character (AZERTY friendly) and supports chords', async () => {
    const { service, ran } = setup();
    service.handle(key({ key: 'P', ctrlKey: true, shiftKey: true }));
    expect(service.handle(key({ key: 'k', ctrlKey: true }))).toBe(true); // chord start
    service.handle(key({ key: 's', ctrlKey: true }));
    service.handle(key({ key: 'k', ctrlKey: true }));
    service.handle(key({ key: 'x', ctrlKey: true })); // broken chord
    await Promise.resolve();
    expect(ran).toEqual(['palette', 'save']);
  });

  it('applies user overrides and reports conflicts', () => {
    const { service, bind } = setup([
      { command: 'quickOpen', key: 'Ctrl+P', remove: true },
      { command: 'other', key: 'Ctrl+P' },
    ]);
    expect(service.bindings.find((binding) => binding.strokes.join() === 'Ctrl+P')?.command).toBe(
      'other',
    );
    expect(service.keyFor('other')).toBe('Ctrl+P');
    expect(service.conflicts()).toEqual([]);
    bind({ key: 'Ctrl+Shift+P', command: 'other' });
    expect(service.conflicts().map((conflict) => conflict.key)).toEqual(['Ctrl+Shift+P']);
  });
});

describe('resolveKeymap', () => {
  const defaults = [
    { key: 'Mod+S', command: 'save', args: [] },
    { key: 'F5', command: 'play', args: [], when: '!playing' },
    { key: 'Ctrl+K S', command: 'saveAll', args: [] },
  ];
  const keys = (bindings: ReturnType<typeof resolveKeymap>) =>
    bindings.map((binding) => `${binding.source}:${binding.command}:${binding.strokes.join(' ')}`);

  it('applies the preset, then the overrides, in order', () => {
    const bindings = resolveKeymap(
      defaults,
      [
        { command: 'play', key: 'F5', remove: true },
        { command: 'play', key: 'F9' },
      ],
      [
        { command: 'play', key: 'F9', remove: true },
        { command: 'play', key: 'F9' },
        { command: 'open', key: 'Ctrl+F1', args: ['game'] },
        { command: 'save', key: 'Mod+S', remove: true },
      ],
      undefined,
    );
    expect(keys(bindings)).toEqual([
      'user:play:F9',
      'user:open:Ctrl+F1',
      'default:saveAll:Ctrl+K S',
    ]);
    expect(bindings[1]!.args).toEqual(['game']);
  });

  it('removes by action: the command and its arguments', () => {
    const withArgs = [
      { key: 'Ctrl+F1', command: 'open', args: ['scene'] },
      { key: 'Ctrl+F1', command: 'open', args: ['game'] },
    ];
    const bindings = resolveKeymap(
      withArgs,
      [],
      [{ command: 'open', key: 'Ctrl+F1', args: ['game'], remove: true }],
    );
    expect(bindings.map((binding) => binding.args)).toEqual([['scene']]);
  });

  it('skips invalid entries and does not add a shortcut twice', () => {
    const invalid: unknown[] = [];
    const bindings = resolveKeymap(
      defaults,
      [],
      [
        { command: 'save', key: 'Mod+S' },
        { command: 'save', key: 'Nope+S' },
        { command: 'save', key: 'F2', when: '((' },
      ],
      (binding) => invalid.push(binding.key),
    );
    expect(bindings).toHaveLength(3);
    expect(invalid).toEqual(['Nope+S', 'F2']);
  });
});

describe('conflicts', () => {
  const [save, saveAs, guarded, other, chord, sameAction] = resolveKeymap(
    [
      { key: 'Ctrl+K', command: 'save', args: [] },
      { key: 'Ctrl+K', command: 'saveAs', args: [] },
      { key: 'Ctrl+K', command: 'guarded', args: [], when: 'a' },
      { key: 'Ctrl+K', command: 'other', args: [], when: 'b' },
      { key: 'Ctrl+K S', command: 'chord', args: [], when: 'b' },
      { key: 'Ctrl+K', command: 'save', args: [], when: 'c' },
    ],
    [],
    [],
  ) as [never, never, never, never, never, never];

  it('needs different actions and conditions that overlap', () => {
    expect(bindingsConflict(save, saveAs)).toBe(true);
    expect(bindingsConflict(save, guarded)).toBe(true);
    expect(bindingsConflict(guarded, other)).toBe(false);
    expect(bindingsConflict(save, sameAction)).toBe(false);
  });

  it('sees a shortcut hiding a chord', () => {
    expect(bindingsConflict(other, chord)).toBe(true);
    expect(bindingsConflict(guarded, chord)).toBe(false);
  });

  it('tells actions with different arguments apart', () => {
    const [scene, game] = resolveKeymap(
      [
        { key: 'F1', command: 'open', args: ['scene'] },
        { key: 'F1', command: 'open', args: ['game'] },
      ],
      [],
      [],
    );
    expect(bindingsConflict(scene!, game!)).toBe(true);
  });

  it('groups conflicts by the keys they share', () => {
    const groups = findConflicts([save, saveAs, guarded, other, chord, sameAction]);
    expect(groups.map((group) => group.key)).toEqual(['Ctrl+K']);
    expect(groups[0]!.bindings).toHaveLength(6);
  });
});

describe('recording', () => {
  it('saves the main modifier as Mod', () => {
    expect(portableStroke('Ctrl+Shift+P', false)).toBe('Mod+Shift+P');
    expect(portableStroke('Shift+Meta+P', true)).toBe('Mod+Shift+P');
    expect(portableStroke('Ctrl+P', true)).toBe('Ctrl+P');
    expect(portableStroke('Ctrl++', false)).toBe('Mod++');
    expect(portableStroke('F5', false)).toBe('F5');
    expect(normalizeStroke(portableStroke('Ctrl+Alt+K', false), false)).toBe('Ctrl+Alt+K');
  });

  it('lets keys through while suspended', () => {
    const extensions = new ExtensionRegistry();
    const context = new ContextKeyService();
    const commands = new CommandRegistry(new Container(), context);
    let ran = 0;
    commands.register({ id: 'go', handler: () => void ran++ });
    extensions.contribute(KEYBINDINGS, { key: 'F5', command: 'go', args: [] }, { owner: 'core' });
    const service = new KeybindingService(extensions, commands, context);
    const suspended = service.suspend();
    expect(service.handle(key({ key: 'F5' }))).toBe(false);
    suspended.dispose();
    suspended.dispose();
    expect(service.handle(key({ key: 'F5' }))).toBe(true);
    expect(ran).toBe(1);
  });
});
