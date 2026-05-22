import type { IEventEmitter } from '$lib/client/event';

export type RawEventEmitter = IEventEmitter<string, Record<string, any[]>>;
