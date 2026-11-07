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

/** Pending changes of one setting, by scope. */
export type PendingChanges = ReadonlyMap<WritableScope, PendingChange>;

/** Writable scopes from the lowest precedence to the highest. */
const PRECEDENCE: readonly WritableScope[] = ['account', 'machine', 'project', 'projectLocal'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const deepMerge = (base: unknown, value: unknown): unknown => {
  if (!isRecord(base) || !isRecord(value)) return value;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, entry] of Object.entries(value)) merged[key] = deepMerge(merged[key], entry);
  return merged;
};

/** How the settings service combines the values of the scopes (`mergeStrategy`). */
const combine = (definition: SettingDefinition, values: readonly unknown[]): unknown => {
  switch (definition.mergeStrategy) {
    case 'deep':
      return values.reduce((merged, value) => deepMerge(merged, value));
    case 'union': {
      if (!values.every(Array.isArray)) return values.at(-1);
      const seen = new Set<string>();
      return (values as unknown[][]).flat().filter((item) => {
        const key = JSON.stringify(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    default:
      return values.at(-1);
  }
};

/**
 * Changes made in the dialog, written on Apply. A setting can have one pending change per scope:
 * a list such as `plugins.disabled` merges every scope, so editing it may touch several.
 */
export class SettingsDraft {
  private readonly _changes = new ObservableValue<ReadonlyMap<string, PendingChanges>>(new Map());
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

  /** Changes the target scope; a value set in the previous target moves with it. */
  setScope(definition: SettingDefinition, scope: WritableScope): void {
    const previous = this.scopeOf(definition);
    this._scopes.set(new Map(this._scopes.get()).set(definition.key, scope));
    const change = this._changes.get().get(definition.key)?.get(previous);
    if (change?.kind !== 'set' || previous === scope) return;
    this._drop(definition.key, previous);
    this._put(definition.key, { ...change, scope });
  }

  /** The value shown for a setting: every scope with its pending change, combined. */
  valueOf(definition: SettingDefinition): unknown {
    const pending = this._changes.get().get(definition.key);
    if (!pending) return this._settings.get(definition);
    const { scopes } = this._settings.inspect(definition);
    const values: unknown[] = [definition.default];
    for (const scope of PRECEDENCE) {
      const change = pending.get(scope);
      const value = change ? (change.kind === 'set' ? change.value : undefined) : scopes[scope];
      if (value !== undefined) values.push(value);
    }
    return combine(definition, values);
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
    const change = this._changes.get().get(definition.key)?.get(scope);
    if (change) return change.kind === 'set' ? change.value : undefined;
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

  /** Writes every pending change; resolves with the ones that failed (they stay pending). */
  async apply(): Promise<{ key: string; error: unknown }[]> {
    const failed: { key: string; error: unknown }[] = [];
    const remaining = new Map<string, PendingChanges>();
    for (const [key, changes] of this._changes.get()) {
      for (const change of changes.values()) {
        try {
          if (change.kind === 'set') await this._settings.set(key, change.value, change.scope);
          else await this._settings.reset(key, change.scope);
        } catch (error) {
          failed.push({ key, error });
          remaining.set(key, new Map(remaining.get(key)).set(change.scope, change));
        }
      }
    }
    this._changes.set(remaining);
    return failed;
  }

  private _put(key: string, change: PendingChange): void {
    const changes = new Map(this._changes.get().get(key)).set(change.scope, change);
    this._changes.set(new Map(this._changes.get()).set(key, changes));
  }

  private _drop(key: string, scope: WritableScope): void {
    const changes = new Map(this._changes.get().get(key));
    changes.delete(scope);
    const next = new Map(this._changes.get());
    if (changes.size) next.set(key, changes);
    else next.delete(key);
    this._changes.set(next);
  }
}
