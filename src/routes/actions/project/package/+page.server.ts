import { createComponentProjectAction } from '$lib/server/actions/project/package/create-component.action';
import { createSystemProjectAction } from '$lib/server/actions/project/package/create-system.action';
import { getComponentsManifestsAction } from '$lib/server/actions/project/package/get-components-manifests.action';
import { getComponentsAction } from '$lib/server/actions/project/package/get-components.action';
import { getSystemsManifestsAction } from '$lib/server/actions/project/package/get-systems-manifests.action';
import { getSystemsAction } from '$lib/server/actions/project/package/get-systems.action';
import { installPackagesAction } from '$lib/server/actions/project/package/install-packages.action';
import { searchPackagesAction } from '$lib/server/actions/project/package/search-packages.action';

export const actions = {
  'create-component': createComponentProjectAction,
  'create-system': createSystemProjectAction,
  'get-components-manifests': getComponentsManifestsAction,
  'get-systems-manifests': getSystemsManifestsAction,
  'get-components': getComponentsAction,
  'get-systems': getSystemsAction,
  'install-packages': installPackagesAction,
  'search-packages': searchPackagesAction,
};
