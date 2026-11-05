import { NanoforgeFactory } from "@nanoforge-dev/core";
import { EcsLibrary } from "@nanoforge-dev/ecs/client";
import { Layer } from "@nanoforge-dev/graphics-2d";

import { CircleComponent, Position, Velocity } from "./components/components";
import { move } from "./systems/systems";
import { Gravity } from "./components/gravity";
import { fall } from "./systems/fall";

export const layer = new Layer();

export const main = async () => {
  const app = NanoforgeFactory.createClient({ tickRate: 60 });
  const ecs = new EcsLibrary();
  app.use(ecs);
  const registry = ecs.registry;
  const ball = registry.spawnEntity();
  registry.addComponent(ball, new Position(0, 0));
  registry.addComponent(ball, new Velocity(1, 1));
  registry.addComponent(ball, new Gravity(2));
  registry.addComponent(ball, new CircleComponent(undefined as never));
  registry.addSystem(move);
  registry.addSystem(fall);
};
