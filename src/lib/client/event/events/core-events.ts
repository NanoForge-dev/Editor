import type { Save } from '@utils/types';

export enum CoreEvents {
  HOT_RELOAD = 'hot-reload',
  HARD_RELOAD = 'hard-reload',
  PAUSE_GAME = 'pause-game',
  STOP_GAME = 'stop-game',
  UNPAUSE_GAME = 'unpause-game',
}

export interface CoreEventsMap {
  [CoreEvents.HOT_RELOAD]: [save: Save];
  [CoreEvents.HARD_RELOAD]: [save: Save];
  [CoreEvents.PAUSE_GAME]: [];
  [CoreEvents.STOP_GAME]: [];
  [CoreEvents.UNPAUSE_GAME]: [];
}
