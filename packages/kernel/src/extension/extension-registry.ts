import { Emitter, type Event } from '../event/emitter';
import { type Disposable, toDisposable } from '../lifecycle/disposable';
import type { Observable } from '../observable/observable';
import { ContributionError } from './contribution.exception';
import type { ContributeOptions, Contribution, ExtensionPoint } from './extension-point.type';

let sequence = 0;

/** Contributions are ordered by descending priority, then registration order. */
const compare = (a: Contribution<unknown>, b: Contribution<unknown>) =>
  b.priority - a.priority || a.seq - b.seq;

export class ExtensionRegistry implements Disposable {
  private readonly _contributions = new Map<string, Contribution<unknown>[]>();
  private readonly _onDidChange = new Emitter<ExtensionPoint<unknown>>();

  readonly onDidChange: Event<ExtensionPoint<unknown>> = this._onDidChange.event;

  contribute<T>(point: ExtensionPoint<T>, value: T, options: ContributeOptions): Disposable {
    let parsed = value;
    if (point.validator) {
      try {
        parsed = point.validator.parse(value);
      } catch (error) {
        throw new ContributionError(point.id, options.owner, error);
      }
    }
    const contribution: Contribution<unknown> = {
      value: parsed,
      owner: options.owner,
      priority: options.priority ?? 0,
      seq: sequence++,
    };
    const list = this._contributions.get(point.id) ?? [];
    list.push(contribution);
    list.sort(compare);
    this._contributions.set(point.id, list);
    this._onDidChange.fire(point);

    return toDisposable(() => {
      const current = this._contributions.get(point.id);
      const index = current?.indexOf(contribution) ?? -1;
      if (index < 0) return;
      current!.splice(index, 1);
      this._onDidChange.fire(point);
    });
  }

  /** Active contributions, highest priority first. */
  getContributions<T>(point: ExtensionPoint<T>): readonly Contribution<T>[] {
    const list = (this._contributions.get(point.id) ?? []) as Contribution<T>[];
    return point.multiple ? [...list] : list.slice(0, 1);
  }

  getValues<T>(point: ExtensionPoint<T>): T[] {
    return this.getContributions(point).map((contribution) => contribution.value);
  }

  observe<T>(point: ExtensionPoint<T>): Observable<readonly Contribution<T>[]> {
    return {
      get: () => this.getContributions(point),
      subscribe: (run) => {
        run(this.getContributions(point));
        const subscription = this.onDidChange((changed) => {
          if (changed.id === point.id) run(this.getContributions(point));
        });
        return () => subscription.dispose();
      },
    };
  }

  /** Removes every contribution of an owner (plugin unload safety net). */
  removeOwner(owner: string): void {
    for (const [id, list] of this._contributions) {
      const kept = list.filter((contribution) => contribution.owner !== owner);
      if (kept.length === list.length) continue;
      this._contributions.set(id, kept);
      this._onDidChange.fire({ id, validator: undefined, multiple: true });
    }
  }

  dispose(): void {
    this._contributions.clear();
    this._onDidChange.dispose();
  }
}
