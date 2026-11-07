import type { Circle, Rect } from "@nanoforge-dev/graphics-2d";

import { layer } from "../main";

export class CircleComponent {
  name = "CircleComponent";
  component: Circle;

  constructor(component: Circle) {
    this.component = component;
    layer.add(this.component);
  }
}

export class RectangleComponent {
  name = "RectangleComponent";
  component: Rect;

  constructor(component: Rect) {
    this.component = component;
    layer.add(this.component);
  }
}
