import { z } from 'zod';

import type { Disposable, StaticContributionHandler } from '@nanoforge-dev/editor-kernel';

import { SettingDeclarationSchema, fromDeclaration } from '../definition/setting-declaration';
import type { SettingsRegistry } from './settings-registry';

/** Handles `contributes.settings` of plugin manifests. */
export const settingsContributionHandler = (
  registry: SettingsRegistry,
): StaticContributionHandler<z.output<typeof SettingDeclarationSchema>[]> => ({
  key: 'settings',
  validator: z.array(SettingDeclarationSchema),
  apply: (declarations, plugin): Disposable =>
    registry.register(
      ...declarations.map((declaration) => fromDeclaration(declaration, plugin.manifest.name)),
    ),
});
