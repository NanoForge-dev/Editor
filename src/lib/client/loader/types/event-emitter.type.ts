export enum EventTypeEnum {
  HOT_RELOAD = 'hot-reload',
  HARD_RELOAD = 'hard-reload',
  PAUSE_GAME = 'pause-game',
  STOP_GAME = 'stop-game',
  UNPAUSE_GAME = 'unpause-game',
}

export interface EventEnumMap {
  [EventTypeEnum.HOT_RELOAD]: [];
  [EventTypeEnum.HARD_RELOAD]: [];
  [EventTypeEnum.PAUSE_GAME]: [duration: number];
  [EventTypeEnum.STOP_GAME]: [];
  [EventTypeEnum.UNPAUSE_GAME]: [];
}

export type ListenerType<K extends keyof EventEnumMap> = (...args: EventEnumMap[K]) => void;

type QueuedEvent<K extends keyof EventEnumMap = keyof EventEnumMap> = {
  event: K;
  args: EventEnumMap[K];
};

export interface IEventEmitter {
  listeners: {
    [K in keyof EventEnumMap]?: ListenerType<K>[];
  };

  eventQueue: QueuedEvent[];

  runEvents(): void;

  emitEvent<K extends keyof EventEnumMap>(event: K, ...args: EventEnumMap[K]): void;

  addListener<K extends keyof EventEnumMap>(event: K, listener: ListenerType<K>): void;

  on<K extends keyof EventEnumMap>(event: K, listener: ListenerType<K>): void;

  removeListener<K extends keyof EventEnumMap>(event: K, listener: ListenerType<K>): void;

  off<K extends keyof EventEnumMap>(event: K, listener: ListenerType<K>): void;

  removeListenersForEvent(event: keyof EventEnumMap): void;

  removeAllListeners(): void;
}
