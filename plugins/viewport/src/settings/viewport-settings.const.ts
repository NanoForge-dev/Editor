/** Settings of the plugin (declared in its manifest, prefixed with its name). */
export const SETTING = {
  resolution: '@nanoforge/viewport.resolution',
  orientation: '@nanoforge/viewport.orientation',
  zoom: '@nanoforge/viewport.zoom',
  pixelPerfect: '@nanoforge/viewport.pixelPerfect',
  stats: '@nanoforge/viewport.stats',
  muted: '@nanoforge/viewport.muted',
  maximizeOnPlay: '@nanoforge/viewport.maximizeOnPlay',
} as const;

export const GAME_SCREEN = 'viewport.game';
export const SCENE_SCREEN = 'viewport.scene';
