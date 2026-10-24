import type { Observable, SettingsRegistry } from '@nanoforge-dev/editor-sdk';
import type { SettingsPageApi } from '@nanoforge-dev/editor-sdk/ui';

import type { SettingsDraft } from '../../settings/settings-draft';

/** What a contributed settings page reads and writes: the dialog's draft. */
export const settingsPageApi = (
  registry: SettingsRegistry,
  draft: SettingsDraft,
  revision: Observable<number>,
): SettingsPageApi => ({
  value: (key) => {
    const definition = registry.get(key);
    return definition ? draft.valueOf(definition) : undefined;
  },
  scopeValue: (key, scope) => {
    const definition = registry.get(key);
    return definition ? draft.scopeValue(definition, scope) : undefined;
  },
  set: (key, value, scope) => {
    const definition = registry.get(key);
    if (definition) draft.setIn(definition, value, scope);
  },
  isPending: (key) => draft.changes.get().has(key),
  revision,
});
