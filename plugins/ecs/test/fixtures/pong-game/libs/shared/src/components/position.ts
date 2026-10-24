/**
 * Where an entity is, in game units.
 *
 * @component
 * @side shared
 */
export class Position {
  name = "Position";
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}
