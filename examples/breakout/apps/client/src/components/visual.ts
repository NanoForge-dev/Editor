import type { Shape } from "@nanoforge-dev/graphics-2d";

import { layer } from "../layer";

/**
 * Draws the entity: a rectangle, or a text, at its `Position`. Its shape is added to the game's
 * layer, and destroyed with the entity when its scene unloads (`destroy`, called by `EcsScene`).
 *
 * Not named `Sprite`: graphics-2d has a class of that name, and the bundler then renames this one
 * (`Sprite2`). The ECS finds a component by its class name, so it would no longer match the
 * `name` field.
 *
 * @component
 * @side client
 */
export class Visual {
  name = "Visual";

  constructor(
    /** The shape drawn at the entity's position. */
    public shape: Shape,
  ) {
    layer.add(shape);
  }

  /** Removes the shape from the screen. */
  destroy(): void {
    this.shape.destroy();
  }
}
