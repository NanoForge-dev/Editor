import type { Registry } from "@nanoforge-dev/ecs/client";
import { EcsScene } from "@nanoforge-dev/ecs/scene";

import { Position2D } from "../components/position-2d.component";
import { DrawableCircle2D } from "../components/drawable-circle-2d.component";
import { draw2D } from "../systems/draw-2d.system";

/**
 * The game as main made it: its entities and systems, loaded when the game starts.
 *
 * @scene
 * @side client
 */
export class Game extends EcsScene {
  override setup(registry: Registry) {
    const circle = registry.spawnEntity();
    registry.addComponent(circle, new Position2D(500, 500));
    registry.addComponent(circle, new DrawableCircle2D(75, true, "red"));
    registry.addSystem(draw2D);
  }
}
