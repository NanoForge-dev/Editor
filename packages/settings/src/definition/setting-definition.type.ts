import { type z } from 'zod';

import type { WritableScope } from '../scope/setting-scope.enum';

export type MergeStrategy = 'replace' | 'deep' | 'union';

export interface SettingDefinition<T = unknown> {
  /** `<namespace>.<name>`, e.g. `appearance.theme` or `@nanoforge/ecs.gizmos.size`. */
  readonly key: string;
  readonly schema: z.ZodType<T>;
  readonly default: T;
  /** Scopes the setting may be written to (default: all). */
  readonly scopes: readonly WritableScope[];
  /** Whether account values leave the machine (default true). `false` forbids the account scope. */
  readonly sync: boolean;
  readonly mergeStrategy: MergeStrategy;
  readonly title: string;
  readonly description: string;
  /** Settings tree path, e.g. `Editor/Appearance`. */
  readonly category: string;
  readonly order: number;
  readonly tags: readonly string[];
  /** Deprecation notice shown when the setting is written. */
  readonly deprecated?: string;
  /** Former keys whose stored values are read as this setting. */
  readonly renamedFrom: readonly string[];
  /** Plugin name or `core`. */
  readonly owner: string;
}

export type SettingInput<T> = Pick<SettingDefinition<T>, 'key' | 'schema' | 'default'> &
  Partial<Omit<SettingDefinition<T>, 'key' | 'schema' | 'default'>>;
