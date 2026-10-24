import { COLOR_TOKENS } from './tokens';

/**
 * Theme colors for plugin authors using UnoCSS/Tailwind-like tools:
 * `theme: { colors: { nf: nanoforgeColors } }` gives `bg-nf-surface`, `text-nf-muted`…
 */
export const nanoforgeColors: Readonly<Record<string, string>> = Object.fromEntries(
  COLOR_TOKENS.map((token) => [token, `var(--nf-color-${token})`]),
);
