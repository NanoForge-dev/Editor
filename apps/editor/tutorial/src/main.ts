import { type ClientRunOptions } from "@nanoforge-dev/common";
import { NanoforgeFactory } from "@nanoforge-dev/core";
import { EcsLibrary } from "@nanoforge-dev/ecs/client";
import { EditorLibrary } from "@nanoforge-dev/editor-lib";
import { Graphics2DLibrary } from "@nanoforge-dev/graphics-2d";
import { InputLibrary } from "@nanoforge-dev/input";

import { DrawableCircle2D } from "./components/drawable-circle-2d.component";
import { Position2D } from "./components/position-2d.component";
import { Velocity2D } from "./components/velocity-2d.component";
import { draw2D } from "./systems/draw-2d.system";
import { move2D } from "./systems/move-2d.system";

export const main = async (options: ClientRunOptions): Promise<void> => {
  const app = NanoforgeFactory.createClient({ tickRate: 60 });

  const ecs = new EcsLibrary();
  app.use(ecs);
  app.use(new Graphics2DLibrary());
  app.use(new InputLibrary());
  app.use(new EditorLibrary());

  await app.init(options);

  const registry = ecs.registry;

  const ball = registry.spawnEntity();
  registry.addComponent(ball, new Position2D(300, 300));
  registry.addComponent(ball, new Velocity2D(4, 3));
  registry.addComponent(ball, new DrawableCircle2D(40, true, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, "orange"));

  registry.addSystem(move2D);
  registry.addSystem(draw2D);

  await app.run();
};
