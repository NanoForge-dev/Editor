import { addComponentProjectAction } from '$lib/server/actions/project/cli/add-component.action';
import { addSystemProjectAction } from '$lib/server/actions/project/cli/add-system.action';
import { buildProjectAction } from '$lib/server/actions/project/cli/build.action';
import { generateProjectAction } from '$lib/server/actions/project/cli/generate.action';
import { createProjectAction } from '$lib/server/actions/project/cli/new.action';
import { loadProjectAction } from '$lib/server/actions/project/load.action';

export const actions = {
  load: loadProjectAction,
  new: createProjectAction,
  generate: generateProjectAction,
  build: buildProjectAction,
  addComponent: addComponentProjectAction,
  addSystem: addSystemProjectAction,
};
