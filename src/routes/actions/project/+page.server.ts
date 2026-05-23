import { getGatewayProjectsAction } from '$lib/server/actions/project/gateway.action';
import {
  getInfoProjectAction,
  setInfoProjectAction,
} from '$lib/server/actions/project/info.action';
import { loadProjectAction } from '$lib/server/actions/project/load.action';
import { createProjectAction } from '$lib/server/actions/project/new.action';

export const actions = {
  load: loadProjectAction,
  new: createProjectAction,
  'get-info': getInfoProjectAction,
  'set-info': setInfoProjectAction,
  'get-gateway-projects': getGatewayProjectsAction,
};
