import { Velocity } from "../components/components";
import { Gravity } from "../components/gravity";

const clamp = (value: number) => Math.max(0, value);

export function fall(registry: { getZipper: (components: unknown[]) => { Velocity: Velocity; Gravity: Gravity }[] }) {
  for (const { Velocity: velocity, Gravity: gravity } of registry.getZipper([Velocity, Gravity])) {
    velocity.y = clamp(velocity.y + gravity.strength);
  }
}
