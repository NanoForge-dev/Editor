import {
  type AppModel,
  type ProjectService,
  validateFolder,
  validatePackageName,
} from '@nanoforge-dev/editor-sdk';
import type { NotificationService, PromptService } from '@nanoforge-dev/editor-sdk/ui';

import { type ItemKind, createItem, validateItemName } from '../../create/create-item';
import type { EcsService } from '../../service/ecs-service';

export interface CreateFlowServices {
  readonly ecs: EcsService;
  readonly projects: ProjectService;
  readonly prompts: PromptService | undefined;
  readonly notifications: NotificationService | undefined;
}

/** Asks for a name, creates a component or system file in an app or library, and opens it. */
export const createItemFlow = async (
  { ecs, projects, prompts, notifications }: CreateFlowServices,
  kind: ItemKind,
  target: AppModel,
): Promise<void> => {
  const project = projects.current.get();
  if (!project || !prompts) return;
  const name = await prompts.ask({
    title: kind === 'component' ? 'New component' : 'New system',
    label: 'Name',
    value: kind === 'component' ? 'Health' : 'regenerate',
    confirm: 'Create',
    validate: (value) => validateItemName(kind, value),
  });
  if (!name) return;
  try {
    const path = await createItem(project, kind, name, target);
    await ecs.openInCode(path);
  } catch (error) {
    notifications?.notify('error', `Could not create ${name}`, {
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};

/** Asks for a folder and a package name, then creates a shared library (ADR 0004). */
export const createLibraryFlow = async ({
  ecs,
  projects,
  prompts,
  notifications,
}: CreateFlowServices): Promise<void> => {
  const project = projects.current.get();
  if (!project || !prompts) return;
  const folder = await prompts.ask({
    title: 'New shared library',
    label: 'Folder in libs/',
    value: 'shared',
    confirm: 'Next',
    validate: (value) =>
      validateFolder({ exists: (path) => project.fs.entry(path) !== undefined }, 'libs', value),
  });
  if (!folder) return;
  const scope = project.model
    .get()
    .name.toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');
  const packageName = await prompts.ask({
    title: 'New shared library',
    label: 'Package name (how apps import it)',
    value: `@${scope}/${folder}`,
    confirm: 'Create',
    validate: validatePackageName,
  });
  if (!packageName) return;
  if (await ecs.createLibrary(folder, packageName))
    notifications?.notify('success', `Shared library ${packageName} created`, {
      detail: `In libs/${folder}. Apps import it as ${packageName}/components/….`,
    });
};
