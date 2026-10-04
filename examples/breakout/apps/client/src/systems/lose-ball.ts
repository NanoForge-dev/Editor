import type { Context } from "@nanoforge-dev/common";
import type { Registry } from "@nanoforge-dev/ecs/client";

import { HEIGHT } from "../arena";
import { Ball } from "../components/ball";
import { Position } from "../components/position";

/**
 * Takes a life when the ball falls below the paddle, and puts the ball back on it.
 *
 * @system
 * @side client
 */
export function loseBall(registry: Registry, ctx: Context) {
  const vars = ctx.scenes.vars;
  if (vars.has("paused") || !vars.get("served")) return;

  registry.getZipper([Ball, Position]).forEach(({ Position }) => {
    if (Position.y < HEIGHT) return;
    vars.set("lives", (vars.get("lives") ?? 1) - 1);
    vars.set("served", false);
  });
}
