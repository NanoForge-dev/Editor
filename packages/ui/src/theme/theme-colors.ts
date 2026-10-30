import type { ColorToken, ThemeDefinition } from './tokens';

/** A color in sRGB, 0–255, with its alpha 0–1. */
export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

let context: CanvasRenderingContext2D | null | undefined;

/** The pixel `value` draws over a canvas filled with `fallback` (kept when it is not drawn). */
const draw = (context: CanvasRenderingContext2D, value: string, fallback: string) => {
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = fallback;
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  return context.getImageData(0, 0, 1, 1).data;
};

/**
 * Any CSS color (hex, `rgb()`, `oklch()`, `color-mix()` of literals…) in sRGB, as the browser
 * draws it; undefined when it is not a color, or one that depends on the page (`var()`, `env()`,
 * `currentColor`). The canvas skips a `var()` it can't resolve and keeps its fill: the value is
 * drawn over black then white, and taken only when both agree.
 */
export const parseColor = (value: string): Rgba | undefined => {
  context ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!context || !CSS.supports('color', value) || /\bcurrentcolor\b/i.test(value))
    return undefined;
  const [r, g, b, a] = draw(context, value, '#000');
  const [r2, g2, b2, a2] = draw(context, value, '#fff');
  if (r !== r2 || g !== g2 || b !== b2 || a !== a2) return undefined;
  return { r: r!, g: g!, b: b!, a: a! / 255 };
};

const hexByte = (value: number) => Math.round(value).toString(16).padStart(2, '0');

/** `#rrggbb` (or `#rrggbbaa` when translucent): what Monaco takes. */
export const toHex = (color: Rgba): string =>
  `#${hexByte(color.r)}${hexByte(color.g)}${hexByte(color.b)}${color.a < 1 ? hexByte(color.a * 255) : ''}`;

/** A translucent color as it shows over an opaque one. */
export const over = (top: Rgba, bottom: Rgba): Rgba => ({
  r: top.r * top.a + bottom.r * (1 - top.a),
  g: top.g * top.a + bottom.g * (1 - top.a),
  b: top.b * top.a + bottom.b * (1 - top.a),
  a: 1,
});

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ({ r, g, b }: Rgba) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** WCAG contrast ratio of two colors (the first composited over the second). */
export const contrast = (foreground: Rgba, background: Rgba): number => {
  const a = luminance(over(foreground, background));
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

const BACKGROUNDS: ColorToken[] = ['bg', 'surface', 'raised', 'sunken'];

/** The pairs `tokens.ts` promises: text 4.5:1 on every background, control edges 3:1. */
const PAIRS: {
  readonly fg: ColorToken;
  readonly bg: readonly ColorToken[];
  readonly min: number;
}[] = [
  { fg: 'text', bg: BACKGROUNDS, min: 4.5 },
  { fg: 'text-muted', bg: BACKGROUNDS, min: 4.5 },
  { fg: 'text-faint', bg: BACKGROUNDS, min: 4.5 },
  { fg: 'border-strong', bg: BACKGROUNDS, min: 3 },
  { fg: 'on-accent', bg: ['accent'], min: 4.5 },
  { fg: 'selection-text', bg: ['selection'], min: 4.5 },
];

/** Where a theme's text is too faint to read (WCAG AA), one line each. */
export const contrastWarnings = (theme: ThemeDefinition): string[] => {
  const warnings: string[] = [];
  const color = (token: ColorToken) => parseColor(theme.colors[token]);
  const base = color('bg');
  for (const pair of PAIRS) {
    const fg = color(pair.fg);
    for (const token of pair.bg) {
      const raw = color(token);
      if (!fg || !raw) continue;
      const background = base && raw.a < 1 ? over(raw, base) : raw;
      const ratio = contrast(fg, background);
      if (ratio < pair.min)
        warnings.push(`${pair.fg} on ${token} is ${ratio.toFixed(2)}:1 (needs ${pair.min}:1)`);
    }
  }
  return warnings;
};
