import type { ClientRunOptions } from "@nanoforge-dev/common";
import { NanoforgeFactory } from "@nanoforge-dev/core";
import { EcsLibrary } from "@nanoforge-dev/ecs/client";
import { Circle, Graphics2DLibrary, Layer, Rect } from "@nanoforge-dev/graphics-2d";
import { Position } from "@pong-game/shared/components/position";
import { Velocity } from "@pong-game/shared/components/velocity";

import { CircleComponent, RectangleComponent } from "./components/components";

export const layer = new Layer();

export const main = async (options: ClientRunOptions): Promise<void> => {
  const app = NanoforgeFactory.createClient({
    tickRate: 60,
    viewport: { width: 1920, height: 1080, fit: "contain" },
  });
  const graphics = new Graphics2DLibrary();
  const ecs = new EcsLibrary();

  app.use(graphics);
  app.use(ecs);

  await app.init(options);

  const registry = ecs.registry;

  graphics.stage.add(layer);

  const ball = registry.spawnEntity();
  registry.addComponent(ball, new Velocity(4, 4));
  registry.addComponent(ball, new Position(960, 540));
  registry.addComponent(ball, new CircleComponent(new Circle({ radius: 30, fill: "red" })));

  const paddle1 = registry.spawnEntity();
  registry.addComponent(paddle1, new Position(40, 390));
  registry.addComponent(paddle1, new Velocity(0, 0));
  registry.addComponent(
    paddle1,
    new RectangleComponent(new Rect({ fill: "blue", width: 30, height: 300 })),
  );

  const paddle2 = registry.spawnEntity();
  registry.addComponent(paddle2, new Position(1850, 390));
  registry.addComponent(paddle2, new Velocity(0, 0));
  registry.addComponent(
    paddle2,
    new RectangleComponent(new Rect({ fill: "blue", width: 30, height: 300 })),
  );

  await app.run();
};
