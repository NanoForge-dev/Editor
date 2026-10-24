/**
 * How fast an entity moves, in game units per tick.
 *
 * @component
 * @side shared
 */
export class Velocity {
  name = "Velocity";
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}
