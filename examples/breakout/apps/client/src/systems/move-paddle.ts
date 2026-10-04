import type { Context } from "@nanoforge-dev/common";
import type { Registry } from "@nanoforge-dev/ecs/client";
import { InputEnum } from "@nanoforge-dev/input";

import { ARENA } from "../arena";
import { Box } from "../components/box";
import { Paddle } from "../components/paddle";
import { Position } from "../components/position";

/**
 * Moves the paddle with the left and right arrows, inside the walls.
 *
 * @system
 * @side client
 */
export function movePaddle(registry: Registry, ctx: Context) {
  if (ctx.scenes.vars.has("paused")) return;
  const left = ctx.input.isKeyPressed(InputEnum.ArrowLeft) === true;
  const right = ctx.input.isKeyPressed(InputEnum.ArrowRight) === true;
  const direction = Number(right) - Number(left);

  registry.getZipper([Paddle, Position, Box]).forEach(({ Paddle, Position, Box }) => {
    const x = Position.x + direction * Paddle.speed * ctx.app.delta;
    Position.x = Math.min(Math.max(x, ARENA.left), ARENA.right - Box.width);
  });
}
