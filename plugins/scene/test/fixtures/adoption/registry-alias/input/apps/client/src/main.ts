import { type ClientRunOptions } from "@nanoforge-dev/common";
import { NanoforgeFactory } from "@nanoforge-dev/core";
import { EcsLibrary } from "@nanoforge-dev/ecs/client";
import { Graphics2DLibrary } from "@nanoforge-dev/graphics-2d";

import { DrawableCircle2D } from "./components/drawable-circle-2d.component";
import { Position2D } from "./components/position-2d.component";
import { Vector } from "./components/vector";
import { draw2D } from "./systems/draw-2d.system";

export const main = async (options: ClientRunOptions): Promise<void> => {
  const app = NanoforgeFactory.createClient({ tickRate: 60 });

  const ecs = new EcsLibrary();
  app.use(ecs);
  app.use(new Graphics2DLibrary()); // draws the circles

  await app.init(options);

  const r = ecs.registry;

  const player = r.spawnEntity(); // the player
  r.addComponent(player, new Position2D(Vector.zero().x, 500));
  r.addComponent(player, new DrawableCircle2D(75, true, "color r.red"));

  r.addSystem(draw2D); // after the others

  await app.run();
};
