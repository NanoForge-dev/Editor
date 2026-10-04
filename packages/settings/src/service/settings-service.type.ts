import type { SettingDefinition } from '../definition/setting-definition.type';
import type { SettingScope, WritableScope } from '../scope/setting-scope.enum';
import type { SettingValues } from '../store/scope-store.type';

export interface SettingsChange {
  readonly keys: ReadonlySet<string>;
}

export interface SettingInspection<T = unknown> {
  readonly key: string;
  readonly definition: SettingDefinition<T>;
  /** Valid value per scope (undefined when unset, invalid or not allowed in that scope). */
  readonly scopes: Readonly<Partial<Record<SettingScope, T>>>;
  /** Values present in scopes the setting does not allow, or failing its schema. */
  readonly ignored: readonly {
    scope: WritableScope;
    value: unknown;
    reason: 'scope' | 'invalid';
  }[];
  readonly value: T;
  /** Highest scope contributing to the value. */
  readonly effectiveScope: SettingScope;
}

export interface ImportPreview {
  readonly scope: WritableScope;
  readonly added: string[];
  readonly changed: string[];
  readonly unknown: string[];
  readonly rejected: { key: string; reason: string }[];
  readonly patch: SettingValues;
}
