import { type AppModel, appAt } from '@nanoforge-dev/editor-sdk';
import type { FileTemplate } from '@nanoforge-dev/editor-sdk/ui';

import { type ItemKind, itemTemplate, kebab, validateItemName } from './create-item';

/**
 * _New › Component…_ and _New › System…_ of the Files panel, in a folder of an app or a shared
 * library: the same tagged files as the Components panel's, `@side` from the app holding the
 * folder (`shared` in a library).
 */
export const itemFileTemplates = (apps: () => readonly AppModel[]): FileTemplate[] =>
  (['component', 'system'] as const).map((kind: ItemKind) => ({
    id: `ecs.new-${kind}`,
    title: kind === 'component' ? 'Component' : 'System',
    icon: kind === 'component' ? 'blocks' : 'settings',
    category: 'ECS',
    when: 'appType',
    defaultName: kind === 'component' ? 'NewComponent' : 'newSystem',
    create: ({ folder, name }) => {
      const identifier = name.replace(/\.ts$/, '');
      const error = validateItemName(kind, identifier);
      if (error) throw new Error(error);
      const app = appAt(apps(), folder);
      if (!app) throw new Error(`${folder || 'The project root'} is in no app or shared library.`);
      return [{ path: `${kebab(identifier)}.ts`, content: itemTemplate(kind, identifier, app) }];
    },
  }));
