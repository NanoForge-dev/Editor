import { type Disposable, toDisposable } from '../lifecycle/disposable';
import type { Observable } from '../observable/observable';
import { ObservableValue } from '../observable/observable-value';
import { type MessageParams, formatMessage } from './message-format';

export type MessageBundle = Readonly<Record<string, string>>;

export const FALLBACK_LOCALE = 'en';

/**
 * Translations per namespace (a plugin name or `core`) and locale. Lookups fall back from
 * `fr-CA` to `fr` to `en`, then to the key itself so missing strings stay visible.
 */
export class LocalizationService {
  private readonly _bundles = new Map<string, Map<string, MessageBundle[]>>();
  private readonly _locale = new ObservableValue(FALLBACK_LOCALE);
  private readonly _revision = new ObservableValue(0);

  get locale(): Observable<string> {
    return this._locale.readonly();
  }

  /** Bumps whenever the locale or a bundle changes, for UIs to re-render translations. */
  get revision(): Observable<number> {
    return this._revision.readonly();
  }

  setLocale(locale: string): void {
    if (locale === this._locale.get()) return;
    this._locale.set(locale);
    this._revision.update((n) => n + 1);
  }

  registerBundle(namespace: string, locale: string, messages: MessageBundle): Disposable {
    const locales = this._bundles.get(namespace) ?? new Map<string, MessageBundle[]>();
    const bundles = locales.get(locale) ?? [];
    bundles.push(messages);
    locales.set(locale, bundles);
    this._bundles.set(namespace, locales);
    this._revision.update((n) => n + 1);
    return toDisposable(() => {
      bundles.splice(bundles.indexOf(messages), 1);
      this._revision.update((n) => n + 1);
    });
  }

  /** Available locales across all namespaces. */
  get locales(): string[] {
    const set = new Set<string>();
    for (const locales of this._bundles.values())
      for (const locale of locales.keys()) set.add(locale);
    return [...set].sort();
  }

  translate(namespace: string, key: string, params?: MessageParams): string {
    const locale = this._locale.get();
    const message = this._lookup(namespace, key, locale);
    return message === undefined ? key : formatMessage(message, params, locale);
  }

  /** A translator bound to a namespace, e.g. `const t = i18n.scope('@nanoforge/ecs')`. */
  scope(namespace: string): (key: string, params?: MessageParams) => string {
    return (key, params) => this.translate(namespace, key, params);
  }

  private _lookup(namespace: string, key: string, locale: string): string | undefined {
    const locales = this._bundles.get(namespace);
    if (!locales) return undefined;
    const candidates = [locale, locale.split('-')[0]!, FALLBACK_LOCALE];
    for (const candidate of candidates) {
      const bundles = locales.get(candidate) ?? [];
      for (let i = bundles.length - 1; i >= 0; i--) {
        const message = bundles[i]![key];
        if (message !== undefined) return message;
      }
    }
    return undefined;
  }
}
