import { NanoforgeFactory } from "@nanoforge-dev/core";
import { EcsLibrary } from "@nanoforge-dev/ecs/client";
import { Layer } from "@nanoforge-dev/graphics-2d";

import { CircleComponent, Position, Velocity } from "./components/components";
import { move } from "./systems/systems";

export const layer = new Layer();

/** How fast things fall, in pixels per tick. */
export class Gravity {
  name = "Gravity";
  constructor(public strength: number) {}
}

const clamp = (value: number) => Math.max(0, value);

export function fall(registry: { getZipper: (components: unknown[]) => { Velocity: Velocity; Gravity: Gravity }[] }) {
  for (const { Velocity: velocity, Gravity: gravity } of registry.getZipper([Velocity, Gravity])) {
    velocity.y = clamp(velocity.y + gravity.strength);
  }
}

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
