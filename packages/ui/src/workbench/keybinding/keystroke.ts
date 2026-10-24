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

export const startsWith = (strokes: readonly string[], prefix: readonly string[]) =>
  prefix.length <= strokes.length && prefix.every((stroke, index) => strokes[index] === stroke);
