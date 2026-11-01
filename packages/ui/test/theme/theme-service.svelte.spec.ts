import { describe, expect, it } from 'vitest';

import { ExtensionRegistry, type Logger, ObservableValue } from '@nanoforge-dev/editor-kernel';

import { resolveIconOf } from '../../src/components/icons';
import { StyleService } from '../../src/style/style-service';
import {
  DEFAULT_ICON_THEME,
  ICON_THEMES,
  IconThemeContributionSchema,
  IconThemeService,
  iconThemeOf,
} from '../../src/theme/icon-theme';
import { ThemeContributionSchema } from '../../src/theme/theme-contribution';
import { THEMES, ThemeService } from '../../src/theme/theme-service';
import { nanoforgeDark } from '../../src/theme/tokens';
import { FILE_ICONS } from '../../src/workbench/extension-point/file.extension-point';

const BASE = 'http://127.0.0.1/plugins/bundled/@acme/icons/1.0.0/';

const recorder = () => {
  const warnings: string[] = [];
  const logger = { warn: (message: string) => warnings.push(message) } as unknown as Logger;
  return { warnings, logger };
};

const surface = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--nf-color-surface').trim();

const ocean = ThemeContributionSchema.parse({
  id: 'ocean',
  label: 'Ocean',
  extends: 'nanoforge-dark',
  colors: { surface: '#003355' },
});

const acmeIcons = iconThemeOf(
  IconThemeContributionSchema.parse({
    id: 'acme',
    label: 'Acme',
    icons: { 'file-code': 'code.svg' },
    files: [{ pattern: '**/*.ts', icon: 'file-code' }],
  }),
  BASE,
);

describe('ThemeService', () => {
  it('falls back on the default theme when the selected one goes', () => {
    const extensions = new ExtensionRegistry();
    const themes = new ThemeService(extensions, new StyleService(), new ObservableValue('ocean'));
    const contribution = extensions.contribute(THEMES, ocean, { owner: '@acme/ocean' });
    expect(themes.current.get().id).toBe('ocean');
    expect(surface()).toBe('#003355');
    contribution.dispose();
    expect(themes.current.get()).toMatchObject({
      id: 'nanoforge-dark',
      colors: nanoforgeDark.colors,
    });
    expect(document.documentElement.dataset.nfTheme).toBe('nanoforge-dark');
    expect(surface()).toBe(nanoforgeDark.colors.surface);
    themes.dispose();
  });

  it("keeps the default theme when a plugin's theme takes its id, and says so", () => {
    const extensions = new ExtensionRegistry();
    const { warnings, logger } = recorder();
    const themes = new ThemeService(
      extensions,
      new StyleService(),
      new ObservableValue('nanoforge-dark'),
      document.documentElement,
      { logger },
    );
    extensions.contribute(THEMES, { ...ocean, id: 'nanoforge-dark' }, { owner: '@acme/ocean' });
    expect(themes.themes.map((theme) => theme.id)).toEqual(['nanoforge-dark', 'nanoforge-light']);
    expect(themes.current.get()).toMatchObject({
      id: 'nanoforge-dark',
      colors: nanoforgeDark.colors,
    });
    expect(surface()).toBe(nanoforgeDark.colors.surface);
    expect(warnings).toEqual([
      'Theme "nanoforge-dark" of @acme/ocean has the id of a theme already contributed',
    ]);
    themes.dispose();
  });
});

describe('IconThemeService', () => {
  it('falls back on the default icons when the selected icon theme goes', () => {
    const extensions = new ExtensionRegistry();
    const service = new IconThemeService(extensions, new ObservableValue('acme'));
    const contribution = extensions.contribute(ICON_THEMES, acmeIcons, { owner: '@acme/icons' });
    expect(service.current.get().id).toBe('acme');
    expect(resolveIconOf('file-code')).toEqual({ kind: 'url', url: `${BASE}code.svg` });
    contribution.dispose();
    expect(service.current.get()).toBe(DEFAULT_ICON_THEME);
    expect(resolveIconOf('file-code')?.kind).toBe('component');
    expect(extensions.getValues(FILE_ICONS)).toEqual([]);
    service.dispose();
  });

  it("keeps the default icons when a plugin's icon theme takes their id, and says so", () => {
    const extensions = new ExtensionRegistry();
    const { warnings, logger } = recorder();
    const service = new IconThemeService(extensions, new ObservableValue('nanoforge'), logger);
    extensions.contribute(ICON_THEMES, { ...acmeIcons, id: 'nanoforge' }, { owner: '@acme/icons' });
    expect(service.themes).toEqual([DEFAULT_ICON_THEME]);
    expect(service.current.get()).toBe(DEFAULT_ICON_THEME);
    expect(resolveIconOf('file-code')?.kind).toBe('component');
    expect(warnings).toEqual([
      'Icon theme "nanoforge" of @acme/icons has the id of an icon theme already contributed',
    ]);
    service.dispose();
  });
});
