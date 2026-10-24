import type { Context } from "@nanoforge-dev/common";
import type { InputEnum } from "@nanoforge-dev/input";

/** Whether each key was down the last time a system asked. */
const down = new Map<InputEnum, boolean>();

/**
 * Whether `key` went down since the last time a system asked about it.
 *
 * @remarks
 * The state is shared by every system: a key that opens a scene does not also act in that scene
 * while it is still held.
 */
export const justPressed = (ctx: Context, key: InputEnum): boolean => {
  const now = ctx.input.isKeyPressed(key) === true;
  const before = down.get(key) ?? false;
  down.set(key, now);
  return now && !before;
};
