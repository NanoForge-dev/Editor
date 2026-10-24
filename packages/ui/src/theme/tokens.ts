/**
 * Design tokens of the editor. Colors come from themes; everything else is shared.
 * All tokens are CSS custom properties named `--nf-<group>-<name>`.
 */
export const COLOR_TOKENS = [
  /** App chrome behind panels. */
  'bg',
  /** Panels and docks. */
  'surface',
  /** Floating surfaces: menus, dialogs, floating docks. */
  'raised',
  /** Inputs and wells. */
  'sunken',
  'hover',
  'pressed',
  'border',
  'border-strong',
  'text',
  'text-muted',
  'text-faint',
  /** Primary actions and active markers: the NanoForge brand violet. */
  'accent',
  'accent-hover',
  /** Text drawn on the accent color. */
  'on-accent',
  /** Accent used for text (lighter in dark themes for contrast). */
  'accent-text',
  /** Keyboard focus rings and selection. */
  'focus',
  'selection',
  'selection-text',
  'danger',
  'warning',
  'success',
  /** Backdrop of modal dialogs. */
  'scrim',
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];

export interface ThemeDefinition {
  readonly id: string;
  readonly label: string;
  readonly kind: 'dark' | 'light';
  readonly colors: Readonly<Record<ColorToken, string>>;
}

/**
 * Blue-grey steel surfaces with the NanoForge brand violet (`oklch(0.4493 0.1953 294.69)`,
 * shared with the landing page and web workspace) as accent; focus and selection stay blue.
 * The dark theme lifts the violet's lightness so markers stay visible on dark panels.
 */
export const nanoforgeDark: ThemeDefinition = {
  id: 'nanoforge-dark',
  label: 'NanoForge Dark',
  kind: 'dark',
  colors: {
    bg: '#12161d',
    surface: '#1a1f28',
    raised: '#222834',
    sunken: '#141821',
    hover: '#262d3a',
    pressed: '#2d3545',
    border: '#2a3140',
    'border-strong': '#3a4356',
    text: '#d8dde7',
    'text-muted': '#949cae',
    'text-faint': '#626a7d',
    accent: '#855bdd',
    'accent-hover': '#9067ea',
    'on-accent': '#ffffff',
    'accent-text': '#af87ff',
    focus: '#6d91ea',
    selection: '#2c3f68',
    'selection-text': '#eef2ff',
    danger: '#e26b62',
    warning: '#e4924a',
    success: '#62b58c',
    scrim: 'rgba(8, 10, 14, 0.62)',
  },
};

export const nanoforgeLight: ThemeDefinition = {
  id: 'nanoforge-light',
  label: 'NanoForge Light',
  kind: 'light',
  colors: {
    bg: '#dfe3ea',
    surface: '#eef1f5',
    raised: '#f9fafc',
    sunken: '#e6e9ef',
    hover: '#dde2ea',
    pressed: '#d2d8e2',
    border: '#c7cedb',
    'border-strong': '#aab3c4',
    text: '#1c2230',
    'text-muted': '#546076',
    'text-faint': '#7e889b',
    accent: '#612eb3',
    'accent-hover': '#541ea0',
    'on-accent': '#ffffff',
    'accent-text': '#612eb3',
    focus: '#3c63c7',
    selection: '#c9d6f5',
    'selection-text': '#101a33',
    danger: '#bf3f36',
    warning: '#b3611b',
    success: '#2d8a5e',
    scrim: 'rgba(28, 34, 48, 0.4)',
  },
};

/** Theme-independent tokens. */
export const SHARED_TOKENS: Readonly<Record<string, string>> = {
  'font-ui': "'Instrument Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  'font-code': "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  'font-size-xs': '11px',
  'font-size-sm': '12px',
  'font-size-md': '13px',
  'font-size-lg': '15px',
  'font-size-xl': '19px',
  'line-height': '1.45',
  'space-1': '4px',
  'space-2': '8px',
  'space-3': '12px',
  'space-4': '16px',
  'space-5': '24px',
  'space-6': '32px',
  'radius-control': '3px',
  'radius-float': '6px',
  'control-height': '26px',
  'row-height': '24px',
  'shadow-float': '0 10px 30px -8px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.25)',
  'z-dock': '10',
  'z-float': '100',
  'z-dialog': '2000',
  'z-menu': '2500',
  'z-toast': '3000',
  'motion-fast': '90ms',
  motion: '160ms',
  /** The only gradient of the UI (brand violet to focus blue): active screen marker, startup progress. */
  temper: 'linear-gradient(90deg, #855bdd 0%, #6d62e0 50%, #5a80dc 100%)',
};

export const cssVar = (group: 'color' | 'token', name: string) =>
  group === 'color' ? `var(--nf-color-${name})` : `var(--nf-${name})`;

/** CSS declarations of a theme (colors) plus the shared tokens. */
export const themeDeclarations = (theme: ThemeDefinition): string =>
  [
    `color-scheme: ${theme.kind};`,
    ...Object.entries(theme.colors).map(([name, value]) => `--nf-color-${name}: ${value};`),
    ...Object.entries(SHARED_TOKENS).map(([name, value]) => `--nf-${name}: ${value};`),
  ].join('\n  ');
