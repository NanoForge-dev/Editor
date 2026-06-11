import { completeProjectAction } from '$lib/server/actions/project/complete.action';
import {
  getGatewayProjectsAction,
  syncGatewayProjectAction,
} from '$lib/server/actions/project/gateway.action';
import {
  getInfoProjectAction,
  setInfoProjectAction,
} from '$lib/server/actions/project/info.action';
import { loadProjectAction } from '$lib/server/actions/project/load.action';
import { createProjectAction } from '$lib/server/actions/project/new.action';

export const actions = {
  load: loadProjectAction,
  new: createProjectAction,
  complete: completeProjectAction,
  'get-info': getInfoProjectAction,
  'set-info': setInfoProjectAction,
  'get-gateway-projects': getGatewayProjectsAction,
  'sync-gateway-project': syncGatewayProjectAction,
};
