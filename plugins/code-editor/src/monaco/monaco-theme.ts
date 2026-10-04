import type { ThemeDefinition } from '@nanoforge-dev/editor-sdk/ui';

import type { monaco } from './monaco';

/** The editor's theme as a Monaco theme: the colors Monaco takes, from the theme tokens. */
export const monacoThemeOf = (theme: ThemeDefinition): monaco.editor.IStandaloneThemeData => {
  const { colors } = theme;
  const hex = (value: string) => (/^#[0-9a-f]{3,8}$/i.test(value) ? value : undefined);
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
    rules: [],
    colors: Object.fromEntries(entries.filter((entry): entry is [string, string] => !!entry[1])),
  };
};
