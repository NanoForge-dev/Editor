import { type ClientRunOptions } from "@nanoforge-dev/common";
import { NanoforgeFactory } from "@nanoforge-dev/core";
import { EcsLibrary } from "@nanoforge-dev/ecs/client";
import { Graphics2DLibrary } from "@nanoforge-dev/graphics-2d";
import { SceneLibrary } from "@nanoforge-dev/scene";

import { Game } from "./scenes/game";

export const main = async (options: ClientRunOptions): Promise<void> => {
  const app = NanoforgeFactory.createClient({ tickRate: 60 });

  const ecs = new EcsLibrary();
  app.use(ecs);
  app.use(new Graphics2DLibrary()); // draws the circles
  app.use(new SceneLibrary({ initial: Game, scenes: { Game } }));

  await app.init(options);

  await app.run();
};
