import { type Disposable, createToken, toDisposable } from '@nanoforge-dev/editor-kernel';

/**
 * Cascade layers, lowest to highest priority. Svelte component styles are scoped by hashed
 * classes and stay unlayered; layers order the global and injected rules.
 */
export const STYLE_LAYERS = ['reset', 'ui', 'plugins', 'user'] as const;
export type StyleLayer = (typeof STYLE_LAYERS)[number];

export interface InjectOptions {
  /** Scopes the rules under `[data-nf-widget="<id>"]`. */
  readonly widgetId?: string;
  readonly layer?: StyleLayer;
}

const identifier = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');

/** Escapes a value for a double-quoted CSS attribute selector. */
const attributeValue = (value: string) => value.replace(/["\\]/g, '\\$&');

/**
 * Injects constructable stylesheets into a document. Plugin styles live in
 * `@layer plugins.<owner>` and are removed when disposed.
 */
export class StyleService {
  private readonly _sheets = new Set<CSSStyleSheet>();

  constructor(private readonly _document: Document = document) {
    const order = new CSSStyleSheet();
    order.replaceSync(`@layer ${STYLE_LAYERS.join(', ')};`);
    this._add(order);
  }

  inject(owner: string, css: string, options: InjectOptions = {}): Disposable {
    const layer = options.layer ?? (owner === 'core' ? 'ui' : 'plugins');
    const scoped = options.widgetId
      ? `[data-nf-widget="${attributeValue(options.widgetId)}"] {\n${css}\n}`
      : css;
    const body = layer === 'plugins' ? `@layer ${identifier(owner)} {\n${scoped}\n}` : scoped;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer ${layer} {\n${body}\n}`);
    this._add(sheet);
    return toDisposable(() => this._remove(sheet));
  }

  /** Number of sheets currently injected (tests, diagnostics). */
  get size(): number {
    return this._sheets.size;
  }

  private _add(sheet: CSSStyleSheet): void {
    this._sheets.add(sheet);
    this._document.adoptedStyleSheets = [...this._document.adoptedStyleSheets, sheet];
  }

  private _remove(sheet: CSSStyleSheet): void {
    if (!this._sheets.delete(sheet)) return;
    this._document.adoptedStyleSheets = this._document.adoptedStyleSheets.filter(
      (s) => s !== sheet,
    );
  }
}

export const StyleServiceToken = createToken<StyleService>('ui.styles');
