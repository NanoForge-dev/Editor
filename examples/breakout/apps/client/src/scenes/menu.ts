import type { Context } from "@nanoforge-dev/common";
import type { Registry } from "@nanoforge-dev/ecs/client";
import { EcsScene } from "@nanoforge-dev/ecs/scene";
import { Text } from "@nanoforge-dev/graphics-2d";
import { InputEnum } from "@nanoforge-dev/input";

import { Position } from "../components/position";
import { Visual } from "../components/visual";
import { justPressed } from "../keys";
import { Level1 } from "./levels";

/**
 * The title screen. Enter starts a game at level 1, which loads `Run` first.
 *
 * @scene
 * @side client
 * @vars best
 */
export class Menu extends EcsScene {
  override setup(registry: Registry, ctx: Context) {
    // Persistent: kept from one game to the next, while every other var goes with its scene.
    const best = ctx.scenes.vars.init("best", 0, { persistent: true });

    const title = registry.spawnEntity();
    registry.addComponent(title, new Position(0, 170));
    registry.addComponent(
      title,
      new Visual(
        new Text({
          text: "BREAKOUT",
          fontSize: 110,
          fill: "#4aa3ff",
          fontFamily: "monospace",
          fontStyle: "bold",
          width: 1280,
          align: "center",
        }),
      ),
    );
    const prompt = registry.spawnEntity();
    registry.addComponent(prompt, new Position(0, 360));
    registry.addComponent(
      prompt,
      new Visual(
        new Text({
          text: "Press Enter to play",
          fontSize: 36,
          fill: "#e8ecf8",
          fontFamily: "monospace",
          width: 1280,
          align: "center",
        }),
      ),
    );
    const bestScore = registry.spawnEntity();
    registry.addComponent(bestScore, new Position(0, 430));
    registry.addComponent(
      bestScore,
      new Visual(
        new Text({
          text: `Best score ${best}`,
          fontSize: 28,
          fill: "#f9ca24",
          fontFamily: "monospace",
          width: 1280,
          align: "center",
        }),
      ),
    );
    const keys = registry.spawnEntity();
    registry.addComponent(keys, new Position(0, 600));
    registry.addComponent(
      keys,
      new Visual(
        new Text({
          text: "← → move   Space serve   Esc pause",
          fontSize: 24,
          fill: "#8a93ad",
          fontFamily: "monospace",
          width: 1280,
          align: "center",
        }),
      ),
    );

    registry.addSystem(startOnEnter);
  }
}

/**
 * Starts a game when Enter is pressed.
 *
 * @system
 * @side client
 */
export function startOnEnter(_registry: Registry, ctx: Context) {
  if (justPressed(ctx, InputEnum.Enter)) void ctx.scenes.load(ctx, Level1);
}
