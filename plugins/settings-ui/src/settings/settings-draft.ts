import {
  ObservableValue,
  type SettingDefinition,
  type SettingsService,
  type WritableScope,
} from '@nanoforge-dev/editor-sdk';

import { defaultScope } from './setting-control';

export type PendingChange =
  | { readonly kind: 'set'; readonly scope: WritableScope; readonly value: unknown }
  | { readonly kind: 'reset'; readonly scope: WritableScope };

/** Changes made in the dialog, written on Apply. */
export class SettingsDraft {
  private readonly _changes = new ObservableValue<ReadonlyMap<string, PendingChange>>(new Map());
  /** Target scope chosen per setting (defaults to `defaultScope`). */
  private readonly _scopes = new ObservableValue<ReadonlyMap<string, WritableScope>>(new Map());

  constructor(private readonly _settings: SettingsService) {}

  get changes() {
    return this._changes.readonly();
  }

  get scopes() {
    return this._scopes.readonly();
  }

  scopeOf(definition: SettingDefinition): WritableScope {
    return this._scopes.get().get(definition.key) ?? defaultScope(this._settings, definition);
  }

  setScope(definition: SettingDefinition, scope: WritableScope): void {
    this._scopes.set(new Map(this._scopes.get()).set(definition.key, scope));
    const change = this._changes.get().get(definition.key);
    if (change?.kind === 'set') this._put(definition.key, { ...change, scope });
  }

  /** The value shown for a setting: its pending value, else the effective one. */
  valueOf(definition: SettingDefinition): unknown {
    const change = this._changes.get().get(definition.key);
    if (change?.kind === 'set') return change.value;
    if (change?.kind === 'reset') {
      const { scopes } = this._settings.inspect(definition);
      const winner = (['projectLocal', 'project', 'machine', 'account'] as const).find(
        (scope) => scope !== change.scope && scopes[scope] !== undefined,
      );
      return winner ? scopes[winner] : definition.default;
    }
    return this._settings.get(definition);
  }

  set(definition: SettingDefinition, value: unknown): void {
    this._put(definition.key, { kind: 'set', scope: this.scopeOf(definition), value });
  }

  /** Sets the value of a setting in a given scope (pages that edit one scope at a time). */
  setIn(definition: SettingDefinition, value: unknown, scope: WritableScope): void {
    this._put(definition.key, { kind: 'set', scope, value });
  }

  /** What a scope holds for a setting, pending change included; undefined when not set there. */
  scopeValue(definition: SettingDefinition, scope: WritableScope): unknown {
    const change = this._changes.get().get(definition.key);
    if (change?.scope === scope) return change.kind === 'set' ? change.value : undefined;
    return this._settings.inspect(definition).scopes[scope];
  }

  reset(definition: SettingDefinition, scope: WritableScope): void {
    this._put(definition.key, { kind: 'reset', scope });
  }

  discard(key: string): void {
    const next = new Map(this._changes.get());
    next.delete(key);
    this._changes.set(next);
  }

  /** Writes every pending change; resolves with the ones that failed. */
  async apply(): Promise<{ key: string; error: unknown }[]> {
    const failed: { key: string; error: unknown }[] = [];
    for (const [key, change] of this._changes.get()) {
      try {
        if (change.kind === 'set') await this._settings.set(key, change.value, change.scope);
        else await this._settings.reset(key, change.scope);
      } catch (error) {
        failed.push({ key, error });
      }
    }
    this._changes.set(new Map(failed.map(({ key }) => [key, this._changes.get().get(key)!])));
    return failed;
  }

  private _put(key: string, change: PendingChange): void {
    this._changes.set(new Map(this._changes.get()).set(key, change));
  }
}
