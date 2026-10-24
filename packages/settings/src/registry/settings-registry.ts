import {
  type Disposable,
  Emitter,
  type Event,
  createToken,
  toDisposable,
} from '@nanoforge-dev/editor-kernel';

import type { SettingDefinition } from '../definition/setting-definition.type';

/** Every known setting, from the core and plugins. */
export class SettingsRegistry {
  private readonly _definitions = new Map<string, SettingDefinition>();
  private readonly _aliases = new Map<string, string>();
  private readonly _onDidChange = new Emitter<ReadonlySet<string>>();

  /** Fires with the keys (un)registered. */
  readonly onDidChange: Event<ReadonlySet<string>> = this._onDidChange.event;

  register(...definitions: SettingDefinition[]): Disposable {
    for (const definition of definitions) {
      const existing = this._definitions.get(definition.key);
      if (existing) {
        throw new Error(`Setting "${definition.key}" is already declared by ${existing.owner}`);
      }
    }
    for (const definition of definitions) {
      this._definitions.set(definition.key, definition);
      for (const alias of definition.renamedFrom) this._aliases.set(alias, definition.key);
    }
    this._onDidChange.fire(new Set(definitions.map((definition) => definition.key)));
    return toDisposable(() => {
      for (const definition of definitions) {
        if (this._definitions.get(definition.key) !== definition) continue;
        this._definitions.delete(definition.key);
        for (const alias of definition.renamedFrom) this._aliases.delete(alias);
      }
      this._onDidChange.fire(new Set(definitions.map((definition) => definition.key)));
    });
  }

  get<T = unknown>(key: string): SettingDefinition<T> | undefined {
    return this._definitions.get(key) as SettingDefinition<T> | undefined;
  }

  /** The current key for a stored key (itself, or the setting it was renamed to). */
  canonicalKey(key: string): string {
    return this._aliases.get(key) ?? key;
  }

  getAll(): SettingDefinition[] {
    return [...this._definitions.values()].sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.order - b.order || a.key.localeCompare(b.key),
    );
  }
}

export const SettingsRegistryToken = createToken<SettingsRegistry>('settings.registry');
