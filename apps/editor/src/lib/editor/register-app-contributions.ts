import {
  type Container,
  CoreServices,
  type Disposable,
  DisposableStore,
  derived,
} from '@nanoforge-dev/editor-kernel';
import { ProjectServiceToken } from '@nanoforge-dev/editor-project';
import type { SessionInfo } from '@nanoforge-dev/editor-protocol';
import { MENU_ITEMS, MenuItemSchema, STATUS_BAR_ITEMS } from '@nanoforge-dev/editor-ui';

import { goto } from '$app/navigation';

const DOCS_URL = 'https://docs.nanoforge.eu';

/** Commands, menus and status bar items of the editor application itself. */
export const registerAppContributions = (services: Container, session: SessionInfo): Disposable => {
  const store = new DisposableStore();
  const commands = services.get(CoreServices.Commands);
  const extensions = services.get(CoreServices.Extensions);
  const projects = services.get(ProjectServiceToken);

  store.add(
    commands.register({
      id: 'project.close',
      title: 'Close project',
      category: 'File',
      handler: async () => {
        projects.close();
        await goto('/');
      },
    }),
  );
  store.add(
    commands.register({
      id: 'help.docs',
      title: 'Documentation',
      category: 'Help',
      handler: () => void window.open(DOCS_URL, '_blank', 'noopener'),
    }),
  );
  for (const item of [
    { menu: 'file', command: 'project.close', group: 'project' },
    { menu: 'view', command: 'workbench.focusNextPart', group: 'focus' },
    { menu: 'help', command: 'help.docs' },
  ]) {
    store.add(extensions.contribute(MENU_ITEMS, MenuItemSchema.parse(item), { owner: 'core' }));
  }

  store.add(
    extensions.contribute(
      STATUS_BAR_ITEMS,
      {
        id: 'core.project',
        alignment: 'left',
        order: 0,
        text: derived([projects.current], (project) => project?.model.get().name ?? 'No project'),
        tooltip: 'Close the project',
        command: 'project.close',
      },
      { owner: 'core' },
    ),
  );
  store.add(
    extensions.contribute(
      STATUS_BAR_ITEMS,
      {
        id: 'core.mode',
        alignment: 'right',
        order: 10,
        text: derived([], () =>
          session.mode === 'OFFLINE' ? 'Local' : `Online · ${session.user?.name ?? 'signed out'}`,
        ),
      },
      { owner: 'core' },
    ),
  );
  return store;
};
