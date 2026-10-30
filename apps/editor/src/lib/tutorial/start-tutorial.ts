import type { Container } from '@nanoforge-dev/editor-kernel';
import { ProjectServiceToken } from '@nanoforge-dev/editor-project';
import { ProjectsContract, type SessionInfo } from '@nanoforge-dev/editor-protocol';
import { RpcClientToken } from '@nanoforge-dev/editor-rpc';
import { TourServiceToken } from '@nanoforge-dev/editor-ui';

import { goto } from '$app/navigation';

import { TUTORIAL_TOUR_ID } from './tutorial-tour.const';

/**
 * Starts the tutorial. A local editor makes (or reopens) its project, `my-first-game`, and the
 * project page starts the tour (`?tour=`). A hosted editor runs the shorter tour on the open
 * project; false when none is open.
 */
export const startTutorial = async (services: Container, session: SessionInfo): Promise<boolean> => {
  if (session.mode !== 'OFFLINE') {
    if (!services.get(ProjectServiceToken).current.get()) return false;
    return services.get(TourServiceToken).start(TUTORIAL_TOUR_ID);
  }
  const { id } = await services.get(RpcClientToken).api(ProjectsContract).createTutorial({});
  await goto(`/project/${id}?tour=${TUTORIAL_TOUR_ID}`);
  return true;
};
