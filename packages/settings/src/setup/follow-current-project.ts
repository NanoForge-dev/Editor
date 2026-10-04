import {
  type Disposable,
  MutableDisposable,
  type Observable,
  ObservableValue,
} from '@nanoforge-dev/editor-kernel';
import type { ClientProject } from '@nanoforge-dev/editor-project';

import type { SettingsSetup } from './setup-settings';

/** Keeps the project scopes attached to the current project of a window. */
export const followCurrentProject = (
  setup: SettingsSetup,
  current: { subscribe(run: (project: ClientProject | undefined) => void): () => void },
): Disposable & { readonly attached: Observable<string | undefined> } => {
  const attached = new MutableDisposable();
  const attachedId = new ObservableValue<string | undefined>(undefined);
  let generation = 0;
  const unsubscribe = current.subscribe((project) => {
    const token = ++generation;
    attached.clear();
    attachedId.set(undefined);
    if (!project) return;
    void setup.attachProject(project).then((disposable) => {
      if (token !== generation) return disposable.dispose();
      attached.value = disposable;
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
