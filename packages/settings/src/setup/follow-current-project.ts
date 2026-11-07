import {
  type Disposable,
  MutableDisposable,
  type Observable,
  ObservableValue,
} from '@nanoforge-dev/editor-kernel';
import type { ClientProject } from '@nanoforge-dev/editor-project';

import type { SettingsSetup } from './setup-settings';

/**
 * Keeps the project scopes attached to the current project of a window. Attachments run one
 * after the other: a fast switch never has two projects' stores attaching at once. When
 * attaching fails, `onError` hears of it and the project goes on with the other scopes.
 */
export const followCurrentProject = (
  setup: SettingsSetup,
  current: { subscribe(run: (project: ClientProject | undefined) => void): () => void },
  onError?: (error: unknown, project: ClientProject) => void,
): Disposable & { readonly attached: Observable<string | undefined> } => {
  const attached = new MutableDisposable();
  const attachedId = new ObservableValue<string | undefined>(undefined);
  let generation = 0;
  let queue = Promise.resolve();
  const unsubscribe = current.subscribe((project) => {
    const token = ++generation;
    attached.clear();
    attachedId.set(undefined);
    if (!project) return;
    queue = queue.then(async () => {
      if (token !== generation) return;
      try {
        const disposable = await setup.attachProject(project);
        if (token !== generation) return disposable.dispose();
        attached.value = disposable;
      } catch (error) {
        onError?.(error, project);
        if (token !== generation) return;
      }
      attachedId.set(project.id);
    });
  });
  return {
    /** Id of the project whose scopes are attached (layouts and project settings are ready). */
    attached: attachedId.readonly(),
    dispose: () => {
      unsubscribe();
      attached.dispose();
    },
  };
};
