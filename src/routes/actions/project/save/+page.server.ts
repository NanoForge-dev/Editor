import { getSaveAction } from '$lib/server/actions/project/save/get-save.action';
import { setSaveAction } from '$lib/server/actions/project/save/set-save.action';

export const actions = {
  get: getSaveAction,
  set: setSaveAction,
};
