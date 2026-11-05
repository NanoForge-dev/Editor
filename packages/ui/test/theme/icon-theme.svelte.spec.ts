import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';

import { ExtensionRegistry, ObservableValue } from '@nanoforge-dev/editor-kernel';

import Icon from '../../src/components/icon.svelte';
import { registerIconFiles, resolveIconOf, setThemeIcons } from '../../src/components/icons';
import {
  ICON_THEMES,
  IconThemeContributionSchema,
  IconThemeService,
  iconFileUrl,
  iconThemeOf,
} from '../../src/theme/icon-theme';
import { FILE_ICONS } from '../../src/workbench/extension-point/file.extension-point';

const BASE = 'http://127.0.0.1/plugins/bundled/@acme/icons/1.0.0/';

describe('icon files', () => {
  it('are SVG files inside the plugin only', () => {
    expect(iconFileUrl(BASE, 'icons/rocket.svg')).toBe(`${BASE}icons/rocket.svg`);
    for (const path of [
      '../x.svg',
      '/x.svg',
      'https://evil.test/x.svg',
      'icons/x.png',
      'a/../../x.svg',
    ])
      expect(() => iconFileUrl(BASE, path), path).toThrow(/inside the plugin/);
  });

  it("resolve by name: the icon theme's, a contributed file, then the editor's own", () => {
    const added = registerIconFiles({ rocket: `${BASE}rocket.svg`, folder: `${BASE}folder.svg` });
    expect(resolveIconOf('rocket')).toEqual({ kind: 'url', url: `${BASE}rocket.svg` });
    expect(resolveIconOf('folder')?.kind).toBe('component');
    setThemeIcons({ folder: `${BASE}theme-folder.svg` });
    expect(resolveIconOf('folder')).toEqual({ kind: 'url', url: `${BASE}theme-folder.svg` });
    setThemeIcons({});
    added.dispose();
    expect(resolveIconOf('rocket')).toBeUndefined();
  });

  it('draws an SVG file as a mask in the text color, never inline', async () => {
    setThemeIcons({ play: `${BASE}play.svg` });
    const { container } = render(Icon, { name: 'play', size: 20, label: 'Play' });
    const icon = container.querySelector<HTMLElement>('.nf-icon-file')!;
    expect(icon).toBeTruthy();
    expect(icon.getAttribute('aria-label')).toBe('Play');
    expect(getComputedStyle(icon).width).toBe('20px');
    expect(icon.style.getPropertyValue('--nf-icon-url')).toContain('play.svg');
    expect(container.querySelector('svg')).toBeNull();
    setThemeIcons({});
  });
});

describe('icon themes', () => {
  it('replace icons and add file and folder icons while selected', () => {
    const extensions = new ExtensionRegistry();
    const selected = new ObservableValue('nanoforge');
    const service = new IconThemeService(extensions, selected);
    const theme = IconThemeContributionSchema.parse({
      id: 'acme',
      label: 'Acme',
      icons: { 'file-code': 'code.svg', folder: 'folder.svg' },
      files: [{ pattern: '**/*.ts', icon: 'file-code' }],
      folders: [{ pattern: '**/assets', icon: 'folder', iconOpen: 'folder-open' }],
    });
    extensions.contribute(ICON_THEMES, iconThemeOf(theme, BASE), { owner: '@acme/icons' });
    expect(extensions.getValues(FILE_ICONS)).toEqual([]);
    selected.set('acme');
    expect(resolveIconOf('file-code')).toEqual({ kind: 'url', url: `${BASE}code.svg` });
    expect(extensions.getValues(FILE_ICONS)).toMatchObject([
      { pattern: '**/*.ts', icon: 'file-code', priority: 1000 },
      { pattern: '**/assets', folder: true, iconOpen: 'folder-open' },
    ]);
    selected.set('nanoforge');
    expect(resolveIconOf('file-code')?.kind).toBe('component');
    expect(extensions.getValues(FILE_ICONS)).toEqual([]);
    service.dispose();
  });
});
