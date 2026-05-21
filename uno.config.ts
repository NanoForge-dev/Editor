import { createLocalFontProcessor } from '@unocss/preset-web-fonts/local';
import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetWebFonts,
  presetWind4,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss';

export default defineConfig({
  theme: {
    colors: {
      background: 'oklch(var(--background))',
      foreground: 'oklch(var(--foreground))',
      border: 'oklch(var(--border))',
      input: 'oklch(var(--input))',
      ring: 'oklch(var(--ring))',
      card: {
        DEFAULT: 'oklch(var(--card))',
        foreground: 'oklch(var(--card-foreground))',
      },
      popover: {
        DEFAULT: 'oklch(var(--popover))',
        foreground: 'oklch(var(--popover-foreground))',
      },
      primary: {
        DEFAULT: 'oklch(var(--primary))',
        foreground: 'oklch(var(--primary-foreground))',
      },
      secondary: {
        DEFAULT: 'oklch(var(--secondary))',
        foreground: 'oklch(var(--secondary-foreground))',
      },
      muted: {
        DEFAULT: 'oklch(var(--muted))',
        foreground: 'oklch(var(--muted-foreground))',
      },
      accent: {
        DEFAULT: 'oklch(var(--accent))',
        foreground: 'oklch(var(--accent-foreground))',
      },
      destructive: {
        DEFAULT: 'oklch(var(--destructive))',
        foreground: 'oklch(var(--destructive-foreground))',
      },
    },
  },
  rules: [
    // animate-in / animate-out base classes (tailwindcss-animate equivalent)
    [
      'animate-in',
      {
        'animation-name': 'enter',
        'animation-duration': 'var(--un-duration,150ms)',
        '--un-enter-opacity': 'initial',
        '--un-enter-scale': 'initial',
        '--un-enter-rotate': 'initial',
        '--un-enter-translate-x': 'initial',
        '--un-enter-translate-y': 'initial',
      },
    ],
    [
      'animate-out',
      {
        'animation-name': 'exit',
        'animation-duration': 'var(--un-duration,150ms)',
        '--un-exit-opacity': 'initial',
        '--un-exit-scale': 'initial',
        '--un-exit-rotate': 'initial',
        '--un-exit-translate-x': 'initial',
        '--un-exit-translate-y': 'initial',
      },
    ],
    [/^fade-in-(\d+)$/, ([, n]) => ({ '--un-enter-opacity': `${Number(n) / 100}` })],
    [/^fade-out-(\d+)$/, ([, n]) => ({ '--un-exit-opacity': `${Number(n) / 100}` })],
    [/^zoom-in-(\d+)$/, ([, n]) => ({ '--un-enter-scale': `${Number(n) / 100}` })],
    [/^zoom-out-(\d+)$/, ([, n]) => ({ '--un-exit-scale': `${Number(n) / 100}` })],
    [
      /^slide-in-from-top-(\d+)$/,
      ([, n]) => ({ '--un-enter-translate-y': `-${Number(n) * 0.25}rem` }),
    ],
    [
      /^slide-in-from-bottom-(\d+)$/,
      ([, n]) => ({ '--un-enter-translate-y': `${Number(n) * 0.25}rem` }),
    ],
    [
      /^slide-in-from-left-(\d+)$/,
      ([, n]) => ({ '--un-enter-translate-x': `-${Number(n) * 0.25}rem` }),
    ],
    [
      /^slide-in-from-right-(\d+)$/,
      ([, n]) => ({ '--un-enter-translate-x': `${Number(n) * 0.25}rem` }),
    ],
    [
      /^slide-out-to-top-(\d+)$/,
      ([, n]) => ({ '--un-exit-translate-y': `-${Number(n) * 0.25}rem` }),
    ],
    [
      /^slide-out-to-bottom-(\d+)$/,
      ([, n]) => ({ '--un-exit-translate-y': `${Number(n) * 0.25}rem` }),
    ],
    [
      /^slide-out-to-left-(\d+)$/,
      ([, n]) => ({ '--un-exit-translate-x': `-${Number(n) * 0.25}rem` }),
    ],
    [
      /^slide-out-to-right-(\d+)$/,
      ([, n]) => ({ '--un-exit-translate-x': `${Number(n) * 0.25}rem` }),
    ],
  ],
  shortcuts: [
    [
      'modal-overlay',
      'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4',
    ],
    ['modal-card', 'bg-card rounded-2xl w-full max-w-md overflow-hidden'],
    ['modal-header', 'px-6 pt-7 pb-5 flex items-center gap-3.5'],
    ['modal-body', 'px-6 py-5 flex flex-col gap-5'],
    ['modal-footer', 'px-6 pb-6 flex items-center justify-end gap-2'],
    [
      'modal-icon-badge',
      'shrink-0 size-10 rounded-xl bg-primary/10 flex items-center justify-center',
    ],
    ['modal-divider', 'h-px bg-white/[0.04]'],
    [
      'toggle-row',
      'flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors text-left',
    ],
    ['toggle-row-title', 'text-sm text-foreground font-medium leading-tight'],
    ['toggle-row-desc', 'text-xs text-muted-foreground mt-0.5'],
    ['btn-ghost', 'px-4 py-2 text-sm rounded-lg transition-all duration-150 cursor-pointer'],
    [
      'btn-primary',
      'flex items-center hover:bg-primary/80 gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer',
    ],
  ],
  presets: [
    presetWind4(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
    }),
    presetTypography(),
    presetWebFonts({
      fonts: {
        sans: 'DM Sans',
        serif: 'DM Serif Display',
        mono: 'DM Mono',
      },
      processors: createLocalFontProcessor(),
    }),
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  safelist: [
    'i-material-icon-theme-huff',
    'i-material-icon-theme-typescript',
    'i-material-icon-theme-3d',
    'i-material-icon-theme-lyric',
    'i-material-icon-theme-folder-interceptor',
    'i-ic-baseline-add',
    'i-ic-baseline-folder',
    'i-material-icon-theme-json',
    'i-ic-baseline-upload',
    'i-ic-baseline-folder-open',
  ],
});
