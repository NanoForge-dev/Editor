import { addComponentsProjectAction } from '$lib/server/actions/project/package/add-components.action';
import { addSystemsProjectAction } from '$lib/server/actions/project/package/add-systems.action';
import { createComponentProjectAction } from '$lib/server/actions/project/package/create-component.action';
import { createSystemProjectAction } from '$lib/server/actions/project/package/create-system.action';
import { getComponentsManifestsAction } from '$lib/server/actions/project/package/get-components-manifests.action';
import { getSystemsManifestsAction } from '$lib/server/actions/project/package/get-systems-manifests.action';

export const actions = {
  'add-components': addComponentsProjectAction,
  'add-systems': addSystemsProjectAction,
  'create-component': createComponentProjectAction,
  'create-system': createSystemProjectAction,
  'get-components-manifests': getComponentsManifestsAction,
  'get-systems-manifests': getSystemsManifestsAction,
};
