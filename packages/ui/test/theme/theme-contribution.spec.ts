import { describe, expect, it } from 'vitest';

import { ThemeContributionSchema, resolveThemes } from '../../src/theme/theme-contribution';
import {
  SHARED_TOKENS,
  type ThemeDefinition,
  nanoforgeDark,
  nanoforgeLight,
  sharedTokens,
  themeDeclarations,
} from '../../src/theme/tokens';

const parse = (value: unknown) => ThemeContributionSchema.parse(value);

describe('theme contributions', () => {
  it('extends a theme with what it changes, through chains', () => {
    const ocean = parse({
      id: 'ocean',
      label: 'Ocean',
      extends: 'nanoforge-dark',
      colors: { accent: '#0af' },
    });
    const deep = parse({
      id: 'deep',
      label: 'Deep',
      extends: 'ocean',
      syntax: { keyword: '#f0f' },
      tokens: { 'radius-control': '0px' },
    });
    const [, , o, d] = resolveThemes([nanoforgeDark, nanoforgeLight, ocean, deep].map(parse));
    expect(o).toMatchObject({
      id: 'ocean',
      kind: 'dark',
      colors: { ...nanoforgeDark.colors, accent: '#0af' },
    });
    expect(d).toMatchObject({
      kind: 'dark',
      colors: { accent: '#0af', bg: nanoforgeDark.colors.bg },
      syntax: { keyword: '#f0f' },
      tokens: { 'radius-control': '0px' },
    });
  });

  it('refuses values that leave their declaration or load a file', () => {
    const theme = (colors: Record<string, string>, tokens: Record<string, string> = {}) => ({
      id: 'x',
      label: 'X',
      extends: 'nanoforge-dark',
      colors,
      tokens,
    });
    for (const value of [
      'red; } * { background: red } :root {',
      'url(https://example.com/a.png)',
      'image-set("https://example.com/a.png" 1x)',
      '\\75rl(x)',
      '@import "x"',
    ])
      expect(() => parse(theme({ accent: value })), value).toThrow(/not a plain CSS value/);
    expect(
      parse(
        theme({ accent: 'oklch(0.6 0.1 200 / 80%)' }, { 'font-code': '"Fira Code", monospace' }),
      ),
    ).toBeTruthy();
  });

  it('refuses values that run into what follows them', () => {
    const theme = (accent: string) => ({
      id: 'x',
      label: 'X',
      extends: 'nanoforge-dark',
      colors: { accent },
    });
    const refused = (value: string) =>
      expect(() => parse(theme(value)), value).toThrow(/not a plain CSS value/);
    refused('#000 /*');
    refused('rgb(0 0 0');
    refused('rgb(0 0 0))');
    refused('rgb(0 0 0]');
    refused('#000 [x');
    refused('"Fira Code, monospace');
    refused("'Fira Code', 'mono");
    for (const value of [
      'rgb(0 0 0 / 50%)',
      'color-mix(in srgb, rgb(0 0 0) 20%, #fff)',
      '"a ( [ \' b", monospace',
    ])
      expect(parse(theme(value)), value).toBeTruthy();
  });

  it('keeps the first theme of an id and reports the others', () => {
    const reports: string[] = [];
    const usurper = parse({
      id: 'nanoforge-dark',
      label: 'Not the default',
      extends: 'nanoforge-light',
      colors: { accent: '#f00' },
    });
    const themes = resolveThemes(
      [nanoforgeDark, nanoforgeLight, usurper].map(parse).concat(usurper),
      (_id, error, theme) => reports.push(`${theme.label}: ${error.message}`),
    );
    expect(themes.map((theme) => theme.label)).toEqual(['NanoForge Dark', 'NanoForge Light']);
    expect(themes[0]!.colors).toEqual(nanoforgeDark.colors);
    expect(reports).toEqual([
      'Not the default: has the id of a theme already contributed',
      'Not the default: has the id of a theme already contributed',
    ]);
  });

  it('names what is wrong: unknown tokens, missing colors, missing bases and cycles', () => {
    expect(() =>
      parse({ id: 'x', label: 'X', extends: 'nanoforge-dark', colors: { acent: '#fff' } }),
    ).toThrow(/acent/);
    expect(() => parse({ id: 'x', label: 'X', kind: 'dark', colors: { bg: '#000' } })).toThrow(
      /colors lacks surface/,
    );
    const reports: string[] = [];
    const themes = resolveThemes(
      [
        parse({ id: 'a', label: 'A', extends: 'b' }),
        parse({ id: 'b', label: 'B', extends: 'a' }),
        parse({ id: 'c', label: 'C', extends: 'gone' }),
      ],
      (id, error) => reports.push(`${id}: ${error.message}`),
    );
    expect(themes).toEqual([]);
    expect(reports).toEqual([
      'a: extends itself: a → b → a',
      'b: extends itself: b → a → b',
      'c: extends gone, which no installed plugin contributes (c)',
    ]);
  });
});

describe('theme declarations', () => {
  /** The declarations before themes could change tokens: the built-in themes must not move. */
  const before = (theme: ThemeDefinition) =>
    [
      `color-scheme: ${theme.kind};`,
      ...Object.entries(theme.colors).map(([name, value]) => `--nf-color-${name}: ${value};`),
      ...Object.entries(SHARED_TOKENS).map(([name, value]) => `--nf-${name}: ${value};`),
    ].join('\n  ');

  it('are unchanged for the built-in themes at the normal density', () => {
    expect(themeDeclarations(nanoforgeDark)).toBe(before(nanoforgeDark));
    expect(themeDeclarations(nanoforgeLight, 'normal')).toBe(before(nanoforgeLight));
  });

  it("take a theme's fonts and corners, and scale sizes with the density", () => {
    expect(sharedTokens({ tokens: { 'font-ui': 'Comic Neue' } })['font-ui']).toBe('Comic Neue');
    expect(sharedTokens(undefined, 'compact')).toMatchObject({
      'control-height': '22px',
      'row-height': '20px',
      'space-2': '7px',
    });
    expect(sharedTokens(undefined, 'comfortable')).toMatchObject({
      'control-height': '31px',
      'font-size-md': '13px',
    });
  });
});
