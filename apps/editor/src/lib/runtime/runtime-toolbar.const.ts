import { LogLevel } from '@nanoforge-dev/editor-kernel';

export const LOG_LEVELS = {
  debug: LogLevel.Debug,
  info: LogLevel.Info,
  warn: LogLevel.Warn,
  error: LogLevel.Error,
} as const;

export const TOOLBAR = [
  {
    id: 'runtime.play',
    icon: 'play',
    title: 'Play (F5)',
    command: 'runtime.play',
    order: 0,
    when: '!runtime.active',
  },
  {
    id: 'runtime.pause',
    icon: 'pause',
    title: 'Pause',
    command: 'runtime.pause',
    order: 1,
    when: "runtime.state == 'running' && runtime.controllable",
  },
  {
    id: 'runtime.resume',
    icon: 'play',
    title: 'Resume (F5)',
    command: 'runtime.resume',
    order: 1,
    when: "runtime.state == 'paused'",
  },
  {
    id: 'runtime.step',
    icon: 'step-forward',
    title: 'Step one frame',
    command: 'runtime.step',
    order: 2,
    when: "runtime.state == 'paused'",
  },
  {
    id: 'runtime.restart',
    icon: 'rotate-ccw',
    title: 'Restart (Ctrl+Shift+F5)',
    command: 'runtime.restart',
    order: 3,
    when: 'runtime.active',
  },
  {
    id: 'runtime.stop',
    icon: 'square',
    title: 'Stop (Shift+F5)',
    command: 'runtime.stop',
    order: 4,
    when: 'runtime.active',
  },
];
