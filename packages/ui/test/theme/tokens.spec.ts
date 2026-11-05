import { describe, expect, it } from 'vitest';

import { type ThemeDefinition, nanoforgeDark, nanoforgeLight } from '../../src/theme/tokens';

/** WCAG relative luminance of a `#rrggbb` color. */
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
};

const BACKGROUNDS = ['bg', 'surface', 'raised', 'sunken', 'hover', 'pressed'] as const;
const TEXT = ['text', 'text-muted', 'text-faint', 'accent-text', 'danger', 'warning', 'success'];

describe.each([nanoforgeDark, nanoforgeLight])(
  '$label contrast (WCAG AA)',
  (theme: ThemeDefinition) => {
    const color = (token: string) => (theme.colors as Record<string, string>)[token]!;
    const worst = (token: string) =>
      Math.min(...BACKGROUNDS.map((background) => contrast(color(token), color(background))));

    it.each(TEXT)('%s text reaches 4.5:1 on every background', (token) => {
      expect(worst(token)).toBeGreaterThanOrEqual(4.5);
    });

    it('draws control edges and focus at 3:1 at least', () => {
      expect(worst('border-strong')).toBeGreaterThanOrEqual(3);
      expect(worst('focus')).toBeGreaterThanOrEqual(3);
    });

    it('keeps text on the accent and on selections readable', () => {
      expect(contrast(color('on-accent'), color('accent'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color('on-accent'), color('accent-hover'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color('selection-text'), color('selection'))).toBeGreaterThanOrEqual(4.5);
    });
  },
);
