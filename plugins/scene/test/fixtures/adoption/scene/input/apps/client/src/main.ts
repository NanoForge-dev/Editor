import { type ClientRunOptions } from "@nanoforge-dev/common";
import { NanoforgeFactory } from "@nanoforge-dev/core";
import { EcsLibrary } from "@nanoforge-dev/ecs/client";
import { Graphics2DLibrary } from "@nanoforge-dev/graphics-2d";

import { DrawableCircle2D } from "./components/drawable-circle-2d.component";
import { Position2D } from "./components/position-2d.component";
import { draw2D } from "./systems/draw-2d.system";

export const main = async (options: ClientRunOptions): Promise<void> => {
  const app = NanoforgeFactory.createClient({ tickRate: 60 });

  const ecs = new EcsLibrary();
  app.use(ecs);
  app.use(new Graphics2DLibrary());

  await app.init(options);

  const registry = ecs.registry;

  const circle = registry.spawnEntity();
  registry.addComponent(circle, new Position2D(500, 500));
  registry.addComponent(circle, new DrawableCircle2D(75, true, "red"));

  registry.addSystem(draw2D);

  await app.run();
};
