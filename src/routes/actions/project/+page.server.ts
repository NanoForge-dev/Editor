import { addComponentsProjectAction } from '$lib/server/actions/project/cli/add-components.action';
import { addSystemsProjectAction } from '$lib/server/actions/project/cli/add-systems.action';
import { buildProjectAction } from '$lib/server/actions/project/cli/build.action';
import { createComponentProjectAction } from '$lib/server/actions/project/cli/create-component.action';
import { createSystemProjectAction } from '$lib/server/actions/project/cli/create-system.action';
import { generateProjectAction } from '$lib/server/actions/project/cli/generate.action';
import { loadProjectAction } from '$lib/server/actions/project/load.action';
import { createProjectAction } from '$lib/server/actions/project/new.action';
import { getComponentsManifestsAction } from '$lib/server/actions/project/package/get-components-manifests.action';
import { getSystemsManifestsAction } from '$lib/server/actions/project/package/get-systems-manifests.action';
import { getSaveAction } from '$lib/server/actions/project/save/get-save.action';
import { setSaveAction } from '$lib/server/actions/project/save/set-save.action';

export const actions = {
  load: loadProjectAction,
  new: createProjectAction,
  generate: generateProjectAction,
  build: buildProjectAction,
  addComponents: addComponentsProjectAction,
  addSystems: addSystemsProjectAction,
  createComponent: createComponentProjectAction,
  createSystem: createSystemProjectAction,
  getComponentsManifests: getComponentsManifestsAction,
  getSystemsManifests: getSystemsManifestsAction,
  getSave: getSaveAction,
  setSave: setSaveAction,
};
