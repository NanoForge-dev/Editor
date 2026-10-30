import type { EditorComponentManifest } from "@nanoforge-dev/ecs";

export class Velocity2D {
  name = this.constructor.name;

  constructor(
    public x: number,
    public y: number,
  ) {}
}

// * Required to generate code
export default Velocity2D.name;

// * Required for the editor to display the component and generate code
export const EDITOR_COMPONENT_MANIFEST: EditorComponentManifest = {
  name: "Velocity2D",
  description: "Pixels an entity moves each frame",
  params: [
    {
      type: "number",
      name: "x",
      description: "Horizontal speed, in pixels per frame",
      example: 4,
      default: 0,
    },
    {
      type: "number",
      name: "y",
      description: "Vertical speed, in pixels per frame",
      example: 3,
      default: 0,
    },
  ],
};
