/**
 * The paddle the player moves with the arrow keys.
 *
 * @component
 * @side client
 */
export class Paddle {
  name = "Paddle";

  constructor(
    /** In pixels per millisecond. */
    public speed = 0.9,
  ) {}
}
