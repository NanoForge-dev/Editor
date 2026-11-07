import type { EditorSystemManifest, Registry } from "@nanoforge-dev/ecs";

import { Position2D } from "../components/position-2d.component";
import { Velocity2D } from "../components/velocity-2d.component";

/** The size of the area the ball bounces in. */
const WIDTH = 1000;
const HEIGHT = 700;

/** What the zipper gives for each entity that has both components. */
interface Moving {
  Position2D: Position2D;
  Velocity2D: Velocity2D;
}

export function move2D(registry: Registry) {
  const entities = registry.getZipper([Position2D, Velocity2D]);

  entities.forEach(({ Position2D: position, Velocity2D: velocity }: Moving) => {
    // Tutorial: this line has a mistake. The Problems panel says which one.
    position.x += velocity.speed;
    position.y += velocity.y;
    if (position.x < 0 || position.x > WIDTH) velocity.x = -velocity.x;
    if (position.y < 0 || position.y > HEIGHT) velocity.y = -velocity.y;
  });
}

// * Required to generate code
export default move2D.name;

// * Required for the editor to display the system and generate code
export const EDITOR_SYSTEM_MANIFEST: EditorSystemManifest = {
  name: "move2D",
  description: "Moves each entity by its velocity, bouncing on the edges",
  dependencies: ["Position2D", "Velocity2D"],
};
