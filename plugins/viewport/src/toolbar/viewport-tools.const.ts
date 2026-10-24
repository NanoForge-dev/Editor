import { SETTING } from '../settings/viewport-settings.const';

/** Settings mirrored as context keys (`toggled` states of the tools). */
export const TOGGLES = {
  'viewport.stats': SETTING.stats,
  'viewport.muted': SETTING.muted,
  'viewport.pixelPerfect': SETTING.pixelPerfect,
  'viewport.maximizeOnPlay': SETTING.maximizeOnPlay,
} as const;

export const TOOLS = [
  {
    id: 'viewport.pixelPerfect',
    icon: 'grid-3x3',
    title: 'Pixel perfect',
    command: 'viewport.togglePixelPerfect',
    order: 10,
    toggled: 'viewport.pixelPerfect',
  },
  {
    id: 'viewport.stats',
    icon: 'activity',
    title: 'Stats',
    command: 'viewport.toggleStats',
    order: 20,
    toggled: 'viewport.stats',
  },
  {
    id: 'viewport.mute',
    icon: 'volume-2',
    title: 'Mute the game',
    command: 'viewport.toggleMute',
    order: 30,
    when: '!viewport.muted',
  },
  {
    id: 'viewport.unmute',
    icon: 'volume-x',
    title: 'Unmute the game',
    command: 'viewport.toggleMute',
    order: 30,
    when: 'viewport.muted',
    toggled: 'viewport.muted',
  },
  {
    id: 'viewport.screenshot',
    icon: 'camera',
    title: 'Screenshot',
    command: 'viewport.screenshot',
    order: 40,
    when: 'runtime.active',
  },
  {
    id: 'viewport.popOut',
    icon: 'external-link',
    title: 'Pop out',
    command: 'viewport.popOut',
    order: 50,
    when: 'runtime.active',
  },
  {
    id: 'viewport.maximizeOnPlay',
    icon: 'maximize',
    title: 'Maximize on play',
    command: 'viewport.toggleMaximizeOnPlay',
    order: 60,
    toggled: 'viewport.maximizeOnPlay',
  },
] as const;
