import type { Context } from "@nanoforge-dev/common";
import type { Registry } from "@nanoforge-dev/ecs/client";
import { InputEnum } from "@nanoforge-dev/input";

import { justPressed } from "../keys";
import { Menu } from "../scenes/menu";

/**
 * Goes back to the menu when Enter is pressed (the end screens).
 *
 * @system
 * @side client
 */
export function backToMenu(_registry: Registry, ctx: Context) {
  if (justPressed(ctx, InputEnum.Enter)) void ctx.scenes.load(ctx, Menu);
}
