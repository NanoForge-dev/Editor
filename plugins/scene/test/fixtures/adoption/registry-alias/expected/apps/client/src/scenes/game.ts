import type { Registry } from "@nanoforge-dev/ecs/client";
import { EcsScene } from "@nanoforge-dev/ecs/scene";

import { Position2D } from "../components/position-2d.component";
import { Vector } from "../components/vector";
import { DrawableCircle2D } from "../components/drawable-circle-2d.component";
import { draw2D } from "../systems/draw-2d.system";

/**
 * The game as main made it: its entities and systems, loaded when the game starts.
 *
 * @scene
 * @side client
 */
export class Game extends EcsScene {
  override setup(r: Registry) {
    const player = r.spawnEntity(); // the player
    r.addComponent(player, new Position2D(Vector.zero().x, 500));
    r.addComponent(player, new DrawableCircle2D(75, true, "color r.red"));
    r.addSystem(draw2D); // after the others
  }
}
