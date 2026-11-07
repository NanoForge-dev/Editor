import type { Registry } from "@nanoforge-dev/ecs/client";

import { Position } from "../components/position";
import { Visual } from "../components/visual";

/**
 * Puts each shape where its entity is.
 *
 * @system
 * @side client
 */
export function drawVisuals(registry: Registry) {
  registry.getZipper([Visual, Position]).forEach(({ Visual, Position }) => {
    Visual.shape.position({ x: Position.x, y: Position.y });
  });
}
