/**
 * How fast an entity moves, in pixels per millisecond.
 *
 * @component
 * @side client
 */
export class Velocity {
  name = "Velocity";

  constructor(
    /** To the right. */
    public x = 0,
    /** Down. */
    public y = 0,
  ) {}
}
