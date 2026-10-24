/**
 * Where a setting value comes from, lowest to highest precedence:
 * - `default`: the setting definition;
 * - `account`: the user's account (synced; the local user's data dir when offline);
 * - `machine`: this browser only;
 * - `project`: committed with the project (`.nanoforge/editor/settings.json`);
 * - `projectLocal`: this user on this project, never committed.
 */
export const SETTING_SCOPES = ['default', 'account', 'machine', 'project', 'projectLocal'] as const;

export type SettingScope = (typeof SETTING_SCOPES)[number];

/** Scopes a user can write to. */
export type WritableScope = Exclude<SettingScope, 'default'>;

export const WRITABLE_SCOPES: readonly WritableScope[] = [
  'account',
  'machine',
  'project',
  'projectLocal',
];

export const scopeRank = (scope: SettingScope): number => SETTING_SCOPES.indexOf(scope);
