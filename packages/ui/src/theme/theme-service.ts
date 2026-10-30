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

import type { StyleService } from '../style/style-service';
import { contrastWarnings } from './theme-colors';
import {
  type ThemeContribution,
  ThemeContributionSchema,
  resolveThemes,
} from './theme-contribution';
import {
  type Density,
  type ThemeDefinition,
  nanoforgeDark,
  nanoforgeLight,
  themeDeclarations,
} from './tokens';

/**
 * Color themes: the built-in ones and `contributes.themes` of plugins, complete or `extends`
 * another (see `ThemeContributionSchema`).
 */
export const THEMES = defineExtensionPoint<ThemeContribution>('ui.themes', {
  validator: ThemeContributionSchema as never,
});

export interface ThemeServiceOptions {
  /** `appearance.density`: how tight the UI is. */
  readonly density?: Observable<Density>;
  /** Where unresolved themes and faint text are reported. */
  readonly logger?: Logger;
}

/** Applies the selected theme (resolved) and the density to the document root. */
export class ThemeService implements Disposable {
  private readonly _store = new DisposableStore();
  private readonly _applied = new MutableDisposable();
  private readonly _current = new ObservableValue<ThemeDefinition>(nanoforgeDark);
  /** Themes already checked (id and owner): each warns once. */
  private readonly _checked = new Set<string>();
  /** Themes that could not be resolved, each reported once. */
  private readonly _reported = new Set<string>();

  constructor(
    private readonly _extensions: ExtensionRegistry,
    private readonly _styles: StyleService,
    private readonly _selected: Observable<string>,
    private readonly _root: HTMLElement = document.documentElement,
    private readonly _options: ThemeServiceOptions = {},
  ) {
    this._store.add(_extensions.contribute(THEMES, nanoforgeDark, { owner: 'core' }));
    this._store.add(_extensions.contribute(THEMES, nanoforgeLight, { owner: 'core' }));
    const apply = () => this._apply();
    this._store.add(observe(_selected, apply));
    if (_options.density) this._store.add(observe(_options.density, apply));
    this._store.add(_extensions.onDidChange((point) => point.id === THEMES.id && apply()));
  }

  get current(): Observable<ThemeDefinition> {
    return this._current.readonly();
  }

  /** Every theme, resolved (an `extends` chain that can't be is left out). */
  get themes(): ThemeDefinition[] {
    const owners = new Map(
      this._extensions
        .getContributions(THEMES)
        .map((contribution) => [contribution.value, contribution.owner]),
    );
    return resolveThemes(this._extensions.getValues(THEMES), (id, error, theme) => {
      const message = `Theme "${id}" of ${owners.get(theme) ?? 'a plugin'} ${error.message}`;
      if (this._reported.has(message)) return;
      this._reported.add(message);
      this._options.logger?.warn(message);
    });
  }

  dispose(): void {
    this._applied.dispose();
    this._store.dispose();
  }

  private _apply(): void {
    const id = this._selected.get();
    const theme = this.themes.find((candidate) => candidate.id === id) ?? nanoforgeDark;
    this._root.dataset.nfTheme = theme.id;
    this._applied.value = this._styles.inject(
      'core',
      `:root {\n  ${themeDeclarations(theme, this._options.density?.get())}\n}`,
      { layer: 'reset' },
    );
    this._current.set(theme);
    this._check(theme);
  }

  /** Faint text in a plugin's theme, said once to its author (the Console). */
  private _check(theme: ThemeDefinition): void {
    const owner = this._extensions
      .getContributions(THEMES)
      .find((contribution) => contribution.value.id === theme.id)?.owner;
    if (!owner || owner === 'core' || this._checked.has(`${owner}:${theme.id}`)) return;
    this._checked.add(`${owner}:${theme.id}`);
    const warnings = contrastWarnings(theme);
    if (warnings.length)
      this._options.logger?.warn(
        `Theme "${theme.id}" of ${owner} has text too faint to read (WCAG AA): ${warnings.join('; ')}.`,
      );
  }
}

export const ThemeServiceToken = createToken<ThemeService>('ui.theme');
