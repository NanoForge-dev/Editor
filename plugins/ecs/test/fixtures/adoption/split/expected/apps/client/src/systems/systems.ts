import type { Registry } from "@nanoforge-dev/ecs";

import { Position } from "../components/position";
import { Velocity } from "../components/velocity";

export const move = (registry: Registry) => {
  for (const { Position: position, Velocity: velocity } of registry.getZipper([Position, Velocity])) {
    position.x += velocity.x;
  }
};
