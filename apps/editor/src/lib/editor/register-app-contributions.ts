import {
  type Container,
  CoreServices,
  type Disposable,
  DisposableStore,
  derived,
  switchObservable,
} from '@nanoforge-dev/editor-kernel';
import { ProjectServiceToken } from '@nanoforge-dev/editor-project';
import type { SessionInfo } from '@nanoforge-dev/editor-protocol';
import {
  DOCS_URL,
  MENU_ITEMS,
  MenuItemSchema,
  NotificationServiceToken,
  STATUS_BAR_ITEMS,
  TOURS,
  TourSchema,
  notifyError,
} from '@nanoforge-dev/editor-ui';

import { goto } from '$app/navigation';

import { startTutorial } from '../tutorial/start-tutorial';
import { TUTORIAL_TOUR } from '../tutorial/tutorial-tour.const';

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
      id: 'project.show',
      title: 'Show the Project screen',
      category: 'Project',
      handler: () => commands.execute('workbench.openWidget', 'core.project'),
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
  store.add(
    commands.register({
      id: 'help.tutorial',
      title: 'Tutorial',
      category: 'Help',
      handler: async () => {
        const notifications = services.tryGet(NotificationServiceToken);
        try {
          if (!(await startTutorial(services, session)))
            notifications?.notify('info', 'Open a project to take the tour');
        } catch (error) {
          notifyError(notifications, 'Could not start the tutorial', error);
        }
      },
    }),
  );
  store.add(extensions.contribute(TOURS, TourSchema.parse(TUTORIAL_TOUR), { owner: 'core' }));
  for (const item of [
    { menu: 'file', command: 'project.close', group: 'project' },
    { menu: 'view', command: 'workbench.focusNextPart', group: 'focus' },
    { menu: 'help', command: 'help.tutorial', order: 0 },
    { menu: 'help', command: 'help.docs', order: 1 },
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
        text: switchObservable(
          derived(
            [projects.current],
            (project) => project && derived([project.model], (model) => model.name),
          ),
          'No project',
        ),
        tooltip: 'Show the Project screen: apps, shared libraries and settings',
        command: 'project.show',
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
