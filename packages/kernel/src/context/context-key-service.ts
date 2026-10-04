import { Emitter, type Event } from '../event/emitter';
import { type Disposable, toDisposable } from '../lifecycle/disposable';
import type { Observable } from '../observable/observable';
import { parseWhen } from './parse-when';
import type { WhenExpression } from './when.type';

export interface ContextChange {
  readonly keys: ReadonlySet<string>;
}

/**
 * Hierarchical key/value context used by `when` clauses (focus, active screen, selection,
 * installed engine libs…). A scope overlays its parent: its own keys shadow the parent's, and
 * parent changes are forwarded for keys the scope does not shadow.
 */
export class ContextKeyService implements Disposable {
  private readonly _values = new Map<string, unknown>();
  private readonly _onDidChange = new Emitter<ContextChange>();
  private readonly _parentSubscription: Disposable | undefined;

  readonly onDidChange: Event<ContextChange> = this._onDidChange.event;

  constructor(
    readonly name = 'global',
    private readonly _parent?: ContextKeyService,
  ) {
    this._parentSubscription = _parent?.onDidChange(({ keys }) => {
      const visible = new Set([...keys].filter((key) => !this._values.has(key)));
      if (visible.size) this._onDidChange.fire({ keys: visible });
    });
  }

  createScoped(name: string): ContextKeyService {
    return new ContextKeyService(name, this);
  }

  get<T = unknown>(key: string): T | undefined {
    if (this._values.has(key)) return this._values.get(key) as T;
    return this._parent?.get<T>(key);
  }

  set(key: string, value: unknown): void {
    if (this._values.has(key) && Object.is(this._values.get(key), value)) return;
    this._values.set(key, value);
    this._onDidChange.fire({ keys: new Set([key]) });
  }

  delete(key: string): void {
    if (!this._values.delete(key)) return;
    this._onDidChange.fire({ keys: new Set([key]) });
  }

  /** Sets a key for the lifetime of the returned disposable, then restores the previous value. */
  bind(key: string, value: unknown): Disposable {
    const had = this._values.has(key);
    const previous = this._values.get(key);
    this.set(key, value);
    return toDisposable(() => {
      if (had) this.set(key, previous);
      else this.delete(key);
    });
  }

  evaluate(when: string | WhenExpression | undefined): boolean {
    if (when === undefined) return true;
    const expression = typeof when === 'string' ? parseWhen(when) : when;
    return expression.evaluate((key) => this.get(key));
  }

  /** The value of a when clause, re-evaluated only when one of its keys changes. */
  observe(when: string | undefined): Observable<boolean> {
    if (when === undefined) {
      return {
        get: () => true,
        subscribe: (run) => {
          run(true);
          return () => undefined;
        },
      };
    }
    const expression = parseWhen(when);
    return {
      get: () => this.evaluate(expression),
      subscribe: (run) => {
        let current = this.evaluate(expression);
        run(current);
        const subscription = this.onDidChange(({ keys }) => {
          if (![...keys].some((key) => expression.keys.has(key))) return;
          const next = this.evaluate(expression);
          if (next === current) return;
          current = next;
          run(next);
        });
        return () => subscription.dispose();
      },
    };
  }

  dispose(): void {
    this._parentSubscription?.dispose();
    this._onDidChange.dispose();
    this._values.clear();
  }
}
