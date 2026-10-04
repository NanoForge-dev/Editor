import { z } from 'zod';

import {
  type Disposable,
  DisposableStore,
  type ExtensionRegistry,
  MutableDisposable,
  type Observable,
  ObservableValue,
  createToken,
  defineExtensionPoint,
  observe,
} from '@nanoforge-dev/editor-kernel';

import type { StyleService } from '../style/style-service';
import {
  COLOR_TOKENS,
  type ThemeDefinition,
  nanoforgeDark,
  nanoforgeLight,
  themeDeclarations,
} from './tokens';

const ThemeSchema = z.object({
  id: z.string().regex(/^[\w-]+$/),
  label: z.string().min(1),
  kind: z.enum(['dark', 'light']),
  colors: z.object(Object.fromEntries(COLOR_TOKENS.map((token) => [token, z.string().min(1)]))),
}) as unknown as z.ZodType<ThemeDefinition>;

/** Color themes (built-in ones and `contributes.themes` of plugins). */
export const THEMES = defineExtensionPoint<ThemeDefinition>('ui.themes', {
  validator: ThemeSchema,
});

/** Applies the selected theme to the document root. */
export class ThemeService implements Disposable {
  private readonly _store = new DisposableStore();
  private readonly _applied = new MutableDisposable();
  private readonly _current = new ObservableValue<ThemeDefinition>(nanoforgeDark);

  constructor(
    private readonly _extensions: ExtensionRegistry,
    private readonly _styles: StyleService,
    selected: Observable<string>,
    private readonly _root: HTMLElement = document.documentElement,
  ) {
    this._store.add(_extensions.contribute(THEMES, nanoforgeDark, { owner: 'core' }));
    this._store.add(_extensions.contribute(THEMES, nanoforgeLight, { owner: 'core' }));
    const apply = () => this._apply(selected.get());
    this._store.add(observe(selected, apply));
    this._store.add(_extensions.onDidChange((point) => point.id === THEMES.id && apply()));
  }

  get current(): Observable<ThemeDefinition> {
    return this._current.readonly();
  }

  get themes(): ThemeDefinition[] {
    return this._extensions.getValues(THEMES);
  }

  dispose(): void {
    this._applied.dispose();
    this._store.dispose();
  }

  private _apply(id: string): void {
    const theme = this.themes.find((candidate) => candidate.id === id) ?? nanoforgeDark;
    this._root.dataset.nfTheme = theme.id;
    this._applied.value = this._styles.inject('core', `:root {\n  ${themeDeclarations(theme)}\n}`, {
      layer: 'reset',
    });
    this._current.set(theme);
  }
}

export const ThemeServiceToken = createToken<ThemeService>('ui.theme');
