import {
  type Disposable,
  DisposableStore,
  type ExtensionRegistry,
  type Logger,
  MutableDisposable,
  type Observable,
  ObservableValue,
  createToken,
  defineExtensionPoint,
  observe,
} from '@nanoforge-dev/editor-kernel';

import { setThemeIcons } from '../components/icons';
import { FILE_ICONS, type FileIcon } from '../workbench/extension-point/file.extension-point';
import type { IconThemeContribution } from './icon-theme.schema';

export * from './icon-theme.schema';

/** An icon theme with its icons' URLs. */
export interface IconTheme {
  readonly id: string;
  readonly label: string;
  readonly icons: Readonly<Record<string, string>>;
  readonly files: readonly FileIcon[];
}

export const ICON_THEMES = defineExtensionPoint<IconTheme>('ui.iconThemes');

/** The editor's own icons (Lucide): the default, nothing replaced. */
export const DEFAULT_ICON_THEME: IconTheme = {
  id: 'nanoforge',
  label: 'NanoForge',
  icons: {},
  files: [],
};

/** Above every plugin's file icons while the theme is active. */
const THEME_PRIORITY = 1000;

/**
 * The URL of a plugin's SVG file: a relative `.svg` path inside the plugin, never `..`, an
 * absolute path or another site.
 */
export const iconFileUrl = (baseUrl: string, path: string): string => {
  if (!/^[\w./-]+\.svg$/i.test(path) || path.startsWith('/') || path.split('/').includes('..'))
    throw new Error(`${path}: an icon is an .svg file inside the plugin (a relative path)`);
  return new URL(path, baseUrl).href;
};

/** An icon theme's contribution with its paths as URLs of the plugin. */
export const iconThemeOf = (theme: IconThemeContribution, baseUrl: string): IconTheme => ({
  id: theme.id,
  label: theme.label,
  icons: Object.fromEntries(
    Object.entries(theme.icons).map(([name, path]) => [name, iconFileUrl(baseUrl, path)]),
  ),
  files: [
    ...theme.files.map((file) => ({ ...file, priority: THEME_PRIORITY })),
    ...theme.folders.map((folder) => ({ ...folder, folder: true, priority: THEME_PRIORITY })),
  ],
});

/** Applies the selected icon theme (`appearance.iconTheme`): its icons and its file icons. */
export class IconThemeService implements Disposable {
  private readonly _store = new DisposableStore();
  private readonly _files = new MutableDisposable<DisposableStore>();
  private readonly _current = new ObservableValue<IconTheme>(DEFAULT_ICON_THEME);
  /** Icon themes with an id already taken, each reported once. */
  private readonly _reported = new Set<string>();

  constructor(
    private readonly _extensions: ExtensionRegistry,
    private readonly _selected: Observable<string>,
    /** Where icon themes with an id already taken are reported. */
    private readonly _logger?: Logger,
  ) {
    this._store.add(_extensions.contribute(ICON_THEMES, DEFAULT_ICON_THEME, { owner: 'core' }));
    const apply = () => this._apply();
    this._store.add(observe(_selected, apply));
    this._store.add(_extensions.onDidChange((point) => point.id === ICON_THEMES.id && apply()));
  }

  get current(): Observable<IconTheme> {
    return this._current.readonly();
  }

  /** Every icon theme: the first contribution of an id (core's comes first), the rest reported. */
  get themes(): IconTheme[] {
    const themes = new Map<string, IconTheme>();
    for (const { value, owner } of this._extensions.getContributions(ICON_THEMES)) {
      if (!themes.has(value.id)) {
        themes.set(value.id, value);
        continue;
      }
      const message = `Icon theme "${value.id}" of ${owner} has the id of an icon theme already contributed`;
      if (this._reported.has(message)) continue;
      this._reported.add(message);
      this._logger?.warn(message);
    }
    return [...themes.values()];
  }

  dispose(): void {
    this._files.dispose();
    this._store.dispose();
    setThemeIcons({});
  }

  private _apply(): void {
    const id = this._selected.get();
    const theme = this.themes.find((candidate) => candidate.id === id) ?? DEFAULT_ICON_THEME;
    if (theme === this._current.get() && this._files.value) return;
    setThemeIcons(theme.icons);
    const files = new DisposableStore();
    for (const file of theme.files)
      files.add(this._extensions.contribute(FILE_ICONS, file, { owner: `icon-theme:${theme.id}` }));
    this._files.value = files;
    this._current.set(theme);
  }
}

export const IconThemeServiceToken = createToken<IconThemeService>('ui.iconTheme');
