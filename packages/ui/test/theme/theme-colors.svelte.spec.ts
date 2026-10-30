import { describe, expect, it } from 'vitest';

import example from '../../../../tooling/example-theme/nanoforge.manifest.json';
import { contrast, contrastWarnings, parseColor, toHex } from '../../src/theme/theme-colors';
import { ThemeContributionSchema, resolveThemes } from '../../src/theme/theme-contribution';
import { nanoforgeDark, nanoforgeLight } from '../../src/theme/tokens';

describe('theme colors', () => {
  it('reads any CSS color the browser draws', () => {
    expect(toHex(parseColor('#12161d')!)).toBe('#12161d');
    expect(toHex(parseColor('rgb(255 0 0)')!)).toBe('#ff0000');
    expect(parseColor('oklch(0.4493 0.1953 294.69)')).toMatchObject({ a: 1 });
    expect(parseColor('rgba(8, 10, 14, 0.62)')!.a).toBeCloseTo(0.62, 1);
    expect(parseColor('not a color')).toBeUndefined();
  });

  it('takes no color the canvas cannot draw on its own', () => {
    for (const value of [
      'var(--nf-color-bg)',
      'var(--missing, #fff)',
      'color-mix(in srgb, var(--nf-color-bg) 50%, #fff)',
      'env(--x, #000)',
      'currentColor',
      'currentcolor',
    ])
      expect(parseColor(value), value).toBeUndefined();
  });

  it('measures contrast as WCAG does', () => {
    expect(contrast(parseColor('#000')!, parseColor('#fff')!)).toBeCloseTo(21, 0);
    expect(contrast(parseColor('#777')!, parseColor('#fff')!)).toBeCloseTo(4.48, 1);
  });

  it('finds no faint text in the built-in themes, and finds it in a faint one', () => {
    expect(contrastWarnings(nanoforgeDark)).toEqual([]);
    expect(contrastWarnings(nanoforgeLight)).toEqual([]);
    const faint = {
      ...nanoforgeDark,
      colors: { ...nanoforgeDark.colors, 'text-faint': '#3a3f4a' },
    };
    expect(contrastWarnings(faint)).toContainEqual(
      expect.stringMatching(/^text-faint on bg is 1\.\d\d:1 \(needs 4\.5:1\)$/),
    );
  });

  it('finds no faint text in the example theme plugin', () => {
    const themes = resolveThemes(
      [nanoforgeDark, ...example.contributes.themes].map((theme) =>
        ThemeContributionSchema.parse(theme),
      ),
    );
    expect(themes[1]).toMatchObject({ id: 'acme-ocean', kind: 'dark' });
    expect(contrastWarnings(themes[1]!)).toEqual([]);
  });
});
