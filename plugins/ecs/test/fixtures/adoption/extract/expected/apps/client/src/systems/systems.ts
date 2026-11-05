import type { Registry } from "@nanoforge-dev/ecs";

import { Position, Velocity } from "../components/components";

export const move = (registry: Registry) => {
  for (const { Position: position, Velocity: velocity } of registry.getZipper([Position, Velocity])) {
    position.x += velocity.x;
  }
};
