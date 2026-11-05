import type { Circle } from "@nanoforge-dev/graphics-2d";

import { layer } from "../main";

export class CircleComponent {
  name = "CircleComponent";
  constructor(public component: Circle) {
    layer.add(component);
  }
}
