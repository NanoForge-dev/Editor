import type { ConsoleStore } from '../store/console-store';

/** Set by the plugin on activation, read by its widgets. */
let store: ConsoleStore | undefined;

export const setConsoleStore = (value: ConsoleStore | undefined): void => {
  store = value;
};

export const consoleStore = (): ConsoleStore => {
  if (!store) throw new Error('The console plugin is not active');
  return store;
};
