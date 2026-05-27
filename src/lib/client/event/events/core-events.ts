export enum CoreEvents {
  HOT_RELOAD = 'hot-reload',
  HARD_RELOAD = 'hard-reload',
  PAUSE_GAME = 'pause-game',
  STOP_GAME = 'stop-game',
  UNPAUSE_GAME = 'unpause-game',
}

export interface CoreEventsMap {
  [CoreEvents.HOT_RELOAD]: [];
  [CoreEvents.HARD_RELOAD]: [];
  [CoreEvents.PAUSE_GAME]: [duration: number];
  [CoreEvents.STOP_GAME]: [];
  [CoreEvents.UNPAUSE_GAME]: [];
}
