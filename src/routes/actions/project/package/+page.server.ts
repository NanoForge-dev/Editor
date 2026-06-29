import { createComponentProjectAction } from '$lib/server/actions/project/package/create-component.action';
import { createSystemProjectAction } from '$lib/server/actions/project/package/create-system.action';
import { getAssetsAction } from '$lib/server/actions/project/package/get-assets.action';
import { getComponentsAction } from '$lib/server/actions/project/package/get-components.action';
import { getSystemsAction } from '$lib/server/actions/project/package/get-systems.action';
import { installPackagesAction } from '$lib/server/actions/project/package/install-packages.action';
import { searchPackagesAction } from '$lib/server/actions/project/package/search-packages.action';

export const actions = {
  'create-component': createComponentProjectAction,
  'create-system': createSystemProjectAction,
  'get-components': getComponentsAction,
  'get-systems': getSystemsAction,
  'get-assets': getAssetsAction,
  'install-packages': installPackagesAction,
  'search-packages': searchPackagesAction,
};
