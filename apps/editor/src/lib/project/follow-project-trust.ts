import {
  type CommandRegistry,
  type Disposable,
  DisposableStore,
} from '@nanoforge-dev/editor-kernel';
import type { ProjectService } from '@nanoforge-dev/editor-project';
import type { NotificationService } from '@nanoforge-dev/editor-ui';

/**
 * Restricted mode of a local editor: a project whose folder is not trusted opens with its code
 * off (its config is read without running it; its plugins, builds and games don't run). A sticky
 * notification says so and offers to trust the folder, as does `project.trust`.
 */
export const followProjectTrust = (options: {
  projects: ProjectService;
  notifications: NotificationService;
  commands: CommandRegistry;
  /** Hosted editors never run project code: there is no folder to trust. */
  local: boolean;
  /** Reloads the window, so the project loads again with its code on. */
  reload: () => void;
}): Disposable => {
  const store = new DisposableStore();
  if (!options.local) return store;
  let shown: { dismiss(): void } | undefined;

  const trust = async () => {
    const project = options.projects.current.get();
    if (!project || project.trusted) return;
    await options.projects.trust();
    options.reload();
  };

  store.add(
    options.commands.register({
      id: 'project.trust',
      title: 'Trust this folder',
      category: 'Project',
      handler: trust,
    }),
  );
  store.add({
    dispose: options.projects.current.subscribe((project) => {
      shown?.dismiss();
      shown = undefined;
      if (!project || project.trusted) return;
      shown = options.notifications.notify(
        'warning',
        `Restricted mode: ${project.model.get().name}'s code does not run`,
        {
          detail:
            'Its nanoforge.config.ts is read without running it, and its plugins, builds and games stay off. Trust the folder if you trust where it comes from.',
          actions: [{ title: 'Trust this folder', run: trust }],
          timeout: 0,
        },
      );
    }),
  });
  store.add({ dispose: () => shown?.dismiss() });
  return store;
};
