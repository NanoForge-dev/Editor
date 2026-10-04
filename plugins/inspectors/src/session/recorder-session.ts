import type { Recorder } from '../recorder/recorder';

/** Set by the plugin on activation, read by its widgets. */
let recorder: Recorder | undefined;

export const setRecorder = (value: Recorder | undefined): void => {
  recorder = value;
};

export const getRecorder = (): Recorder => {
  if (!recorder) throw new Error('The inspectors plugin is not active');
  return recorder;
};
