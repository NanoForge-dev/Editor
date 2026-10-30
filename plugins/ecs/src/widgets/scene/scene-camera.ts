/** The part of the world in view, in scene units. */
export interface SceneViewBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Design resolution of the game (the engine's default viewport). */
export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

const MARGIN = 0.05;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 16;

/** The whole stage with a margin: the view until zoomed or panned. */
export const FIT: SceneViewBox = {
  x: -STAGE_WIDTH * MARGIN,
  y: -STAGE_HEIGHT * MARGIN,
  width: STAGE_WIDTH * (1 + 2 * MARGIN),
  height: STAGE_HEIGHT * (1 + 2 * MARGIN),
};

export const zoomOf = (view: SceneViewBox): number => FIT.width / view.width;

export const isFitted = (view: SceneViewBox): boolean =>
  view.x === FIT.x && view.y === FIT.y && view.width === FIT.width && view.height === FIT.height;

/** The view after a wheel step at `point` (scene units): zoomed in or out around it, within limits. */
export const zoomAround = (
  view: SceneViewBox,
  point: { readonly x: number; readonly y: number },
  deltaY: number,
): SceneViewBox => {
  const zoom = zoomOf(view);
  const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (deltaY > 0 ? 1 / 1.15 : 1.15)));
  const ratio = zoom / next;
  return {
    x: point.x - (point.x - view.x) * ratio,
    y: point.y - (point.y - view.y) * ratio,
    width: view.width * ratio,
    height: view.height * ratio,
  };
};
