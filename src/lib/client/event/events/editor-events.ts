export enum EditorEvents {
  HOT_RELOAD = 'hot-reload',
  HARD_RELOAD = 'hard-reload',
  PAUSE_GAME = 'pause-game',
  STOP_GAME = 'stop-game',
  UNPAUSE_GAME = 'unpause-game',
}

export interface EditorEventsMap {
  [EditorEvents.HOT_RELOAD]: [];
  [EditorEvents.HARD_RELOAD]: [];
  [EditorEvents.PAUSE_GAME]: [duration: number];
  [EditorEvents.STOP_GAME]: [];
  [EditorEvents.UNPAUSE_GAME]: [];
}
