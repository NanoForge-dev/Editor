/**
 * Dock areas around the main screen, after IntelliJ's tool windows: two on each side, and the
 * bottom split in two (`bottom` is its left part).
 */
export const SLOT_IDS = [
  'leftTop',
  'leftBottom',
  'rightTop',
  'rightBottom',
  'bottom',
  'bottomRight',
] as const;
export type SlotId = (typeof SLOT_IDS)[number];
