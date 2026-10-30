import { parseWhen, tokenizeWhen } from '@nanoforge-dev/editor-kernel';

const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const;

export const isMac = (): boolean =>
  typeof navigator !== 'undefined' &&
  /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

const KEY_ALIASES: Record<string, string> = {
  esc: 'Escape',
  escape: 'Escape',
  del: 'Delete',
  delete: 'Delete',
  enter: 'Enter',
  return: 'Enter',
  space: 'Space',
  ' ': 'Space',
  tab: 'Tab',
  backspace: 'Backspace',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  plus: '+',
};

const normalizeKey = (key: string): string => {
  const alias = KEY_ALIASES[key.toLowerCase()];
  if (alias) return alias;
  if (/^f\d{1,2}$/i.test(key)) return key.toUpperCase();
  if (key.length === 1) return key.toUpperCase();
  return key[0]!.toUpperCase() + key.slice(1);
};

/** Canonical form of one keystroke: `Ctrl+Shift+P` (modifier order Ctrl, Alt, Shift, Meta). */
export const normalizeStroke = (stroke: string, mac = isMac()): string => {
  const parts = stroke.split('+').map((part) => part.trim());
  if (parts.at(-1) === '' && parts.at(-2) === '') parts.splice(-2, 2, '+');
  const key = parts.pop();
  if (!key) throw new Error(`Invalid keybinding "${stroke}"`);
  const modifiers = new Set<string>();
  for (const part of parts) {
    const name = part.toLowerCase();
    if (name === 'mod') modifiers.add(mac ? 'Meta' : 'Ctrl');
    else if (name === 'ctrl' || name === 'control') modifiers.add('Ctrl');
    else if (name === 'alt' || name === 'option') modifiers.add('Alt');
    else if (name === 'shift') modifiers.add('Shift');
    else if (name === 'meta' || name === 'cmd' || name === 'command' || name === 'super')
      modifiers.add('Meta');
    else throw new Error(`Unknown modifier "${part}" in "${stroke}"`);
  }
  return [...MODIFIERS.filter((modifier) => modifiers.has(modifier)), normalizeKey(key)].join('+');
};

/** `Ctrl+K Ctrl+S` → ['Ctrl+K', 'Ctrl+S']. */
export const parseKeybinding = (key: string, mac = isMac()): string[] =>
  key
    .trim()
    .split(/\s+/)
    .map((stroke) => normalizeStroke(stroke, mac));

/** Keystroke of a keyboard event, using the produced character (keyboard layout aware). */
export const strokeFromEvent = (event: KeyboardEvent): string | undefined => {
  if (
    ['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Dead', 'Unidentified'].includes(
      event.key,
    )
  ) {
    return undefined;
  }
  const modifiers = [
    event.ctrlKey && 'Ctrl',
    event.altKey && 'Alt',
    event.shiftKey && 'Shift',
    event.metaKey && 'Meta',
  ].filter(Boolean);
  return [...modifiers, normalizeKey(event.key)].join('+');
};

/** Human readable form for menus: `⌘⇧P` on macOS, `Ctrl+Shift+P` elsewhere. */
export const formatKeybinding = (key: string, mac = isMac()): string =>
  parseKeybinding(key, mac)
    .map((stroke) =>
      mac
        ? stroke
            .replace(/^Shift$/, '⇧')
            .replace(/^Alt$/, '⌥')
            .replace(/^Meta$/, '⌘')
            .replace('Ctrl+', '⌃')
            .replace('Alt+', '⌥')
            .replace('Shift+', '⇧')
            .replace('Meta+', '⌘')
        : stroke,
    )
    .join(' ');

/**
 * A keystroke as saved in a keymap: the platform's main modifier becomes `Mod` (Ctrl, or Cmd on
 * macOS), so a shortcut saved to an account works on both.
 */
export const portableStroke = (stroke: string, mac = isMac()): string => {
  const main = new RegExp(`(^|\\+)${mac ? 'Meta' : 'Ctrl'}\\+`);
  return main.test(stroke) ? `Mod+${stroke.replace(main, '$1')}` : stroke;
};

/**
 * Whether a stroke would take a key from typing if it started a shortcut: shortcuts are caught
 * before the code editor and text fields, so without Ctrl, Alt or ⌘ only function keys are free
 * (a letter would no longer type, Delete no longer delete, an arrow no longer move the caret).
 */
export const blocksTyping = (stroke: string): boolean => {
  const parts = stroke.split('+');
  const key = parts.at(-1) === '' ? '+' : parts.at(-1)!;
  const modifiers = parts.slice(0, parts.at(-1) === '' ? -2 : -1);
  if (modifiers.some((modifier) => modifier !== 'Shift')) return false;
  return !/^F\d{1,2}$/.test(key);
};

type WhenToken = ReturnType<typeof tokenizeWhen>[number];

const isOp = (token: WhenToken | undefined, value: string): boolean =>
  token?.kind === 'op' && token.value === value;

/** The conditions a clause needs all of: its top-level `&&` parts, parentheses opened. */
const conjuncts = (tokens: readonly WhenToken[]): WhenToken[][] => {
  const parts: WhenToken[][] = [[]];
  let depth = 0;
  for (const token of tokens) {
    if (isOp(token, '(')) depth++;
    if (isOp(token, ')')) depth--;
    if (depth === 0 && isOp(token, '||')) return [];
    if (depth === 0 && isOp(token, '&&')) parts.push([]);
    else parts.at(-1)!.push(token);
  }
  return parts.flatMap((part) => {
    if (!isOp(part[0], '(') || !isOp(part.at(-1), ')')) return [part];
    let level = 0;
    const closes = part.findIndex((token) => {
      if (isOp(token, '(')) level++;
      if (isOp(token, ')')) level--;
      return level === 0;
    });
    return closes === part.length - 1 ? conjuncts(part.slice(1, -1)) : [part];
  });
};

/**
 * Whether a `when` clause keeps a shortcut away from typing: `!textInputFocus` is one of the
 * conditions it needs all of (not under `||`), so a plain key bound with it still types in text
 * fields and the code editor. A clause that does not parse keeps nothing away.
 */
export const outsideTyping = (when: string | undefined): boolean => {
  if (!when?.trim()) return false;
  try {
    parseWhen(when);
  } catch {
    return false;
  }
  const tokens = tokenizeWhen(when).filter((token) => token.kind !== 'end');
  return conjuncts(tokens).some(
    ([not, key, ...rest]) =>
      isOp(not, '!') && key?.kind === 'key' && key.value === 'textInputFocus' && !rest.length,
  );
};

export const startsWith = (strokes: readonly string[], prefix: readonly string[]) =>
  prefix.length <= strokes.length && prefix.every((stroke, index) => strokes[index] === stroke);
