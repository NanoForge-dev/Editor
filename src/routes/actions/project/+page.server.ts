import { loadProjectAction } from '$lib/server/actions/project/load.action';
import { createProjectAction } from '$lib/server/actions/project/new.action';

export const actions = {
  load: loadProjectAction,
  new: createProjectAction,
};
