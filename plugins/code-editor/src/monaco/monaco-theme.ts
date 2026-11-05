import {
  type SyntaxToken,
  type ThemeDefinition,
  parseColor,
  toHex,
} from '@nanoforge-dev/editor-sdk/ui';

import type { monaco } from './monaco';

/** The editor's theme as a Monaco theme: the colors Monaco takes, from the theme tokens. */
export const monacoThemeOf = (theme: ThemeDefinition): monaco.editor.IStandaloneThemeData => {
  const { colors } = theme;
  /** Any CSS color (oklch, rgb…) as the hex Monaco takes; undefined if it is not one. */
  const hex = (value: string | undefined) => {
    const color = value ? parseColor(value) : undefined;
    return color ? toHex(color) : undefined;
  };
  const entries: [string, string | undefined][] = [
    ['editor.background', hex(colors.surface)],
    ['editor.foreground', hex(colors.text)],
    ['editorLineNumber.foreground', hex(colors['text-faint'])],
    ['editorLineNumber.activeForeground', hex(colors['text-muted'])],
    ['editorCursor.foreground', hex(colors.accent)],
    ['editor.selectionBackground', hex(colors.selection)],
    ['editorWidget.background', hex(colors.raised)],
    ['editorWidget.border', hex(colors.border)],
    ['editorSuggestWidget.background', hex(colors.raised)],
    ['editorSuggestWidget.selectedBackground', hex(colors.hover)],
    ['focusBorder', hex(colors.focus)],
    ['scrollbarSlider.background', hex(`${colors['border-strong']}`)],
  ];
  return {
    base: theme.kind === 'dark' ? 'vs-dark' : 'vs',
    inherit: true,
    rules: Object.entries(theme.syntax ?? {}).flatMap(([token, value]) => {
      const color = hex(value);
      return color
        ? MONACO_TOKENS[token as SyntaxToken].map((name) => ({
            token: name,
            foreground: color.slice(1),
          }))
        : [];
    }),
    colors: Object.fromEntries(entries.filter((entry): entry is [string, string] => !!entry[1])),
  };
};

/** Monaco's token names for each code color (TypeScript, JavaScript, JSON). */
const MONACO_TOKENS: Record<SyntaxToken, string[]> = {
  keyword: ['keyword'],
  string: ['string', 'string.key.json', 'string.value.json'],
  number: ['number'],
  comment: ['comment'],
  type: ['type', 'type.identifier'],
  variable: ['identifier', 'variable'],
  regexp: ['regexp'],
  delimiter: ['delimiter', 'operator'],
};
