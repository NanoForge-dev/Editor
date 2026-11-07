import type { Circle } from "@nanoforge-dev/graphics-2d";

import { layer } from "../main";

/** Where an entity is. */
export class Position {
  name = "Position";
  constructor(
    public x: number,
    public y: number,
  ) {}
}

export class Velocity {
  name = "Velocity";
  constructor(
    public x: number,
    public y: number,
  ) {}
}

export class CircleComponent {
  name = "CircleComponent";
  constructor(public component: Circle) {
    layer.add(component);
  }
}
