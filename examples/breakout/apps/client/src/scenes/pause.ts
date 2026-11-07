import type { Context } from "@nanoforge-dev/common";
import type { Registry } from "@nanoforge-dev/ecs/client";
import { EcsScene } from "@nanoforge-dev/ecs/scene";
import { Rect, Text } from "@nanoforge-dev/graphics-2d";
import { InputEnum } from "@nanoforge-dev/input";

import { Position } from "../components/position";
import { Visual } from "../components/visual";
import { justPressed } from "../keys";
import { Menu } from "./menu";

/**
 * The pause menu. It has no parent of its own: it is loaded over the current level
 * (`parent: "current"`), so unloading it goes back to that level as it was.
 *
 * @scene
 * @side client
 * @vars paused
 */
export class Pause extends EcsScene {
  override setup(registry: Registry, ctx: Context) {
    // The game's systems stop while it exists, and it goes with this scene.
    ctx.scenes.vars.init("paused", true);

    const shade = registry.spawnEntity();
    registry.addComponent(shade, new Position(0, 0));
    registry.addComponent(
      shade,
      new Visual(new Rect({ width: 1280, height: 720, fill: "rgba(8, 10, 18, 0.72)" })),
    );
    const title = registry.spawnEntity();
    registry.addComponent(title, new Position(0, 250));
    registry.addComponent(
      title,
      new Visual(
        new Text({
          text: "Paused",
          fontSize: 72,
          fill: "#e8ecf8",
          fontFamily: "monospace",
          fontStyle: "bold",
          width: 1280,
          align: "center",
        }),
      ),
    );
    const keys = registry.spawnEntity();
    registry.addComponent(keys, new Position(0, 370));
    registry.addComponent(
      keys,
      new Visual(
        new Text({
          text: "Esc  resume      Q  quit to the menu",
          fontSize: 30,
          fill: "#8a93ad",
          fontFamily: "monospace",
          width: 1280,
          align: "center",
        }),
      ),
    );

    registry.addSystem(pauseMenu);
  }
}

/**
 * Resumes the level with Escape or P, or quits to the menu with Q.
 *
 * @system
 * @side client
 */
export function pauseMenu(_registry: Registry, ctx: Context) {
  const escape = justPressed(ctx, InputEnum.Escape);
  const p = justPressed(ctx, InputEnum.KeyP);
  if (escape || p) void ctx.scenes.unload(ctx, Pause);
  else if (justPressed(ctx, InputEnum.KeyQ)) void ctx.scenes.load(ctx, Menu);
}
