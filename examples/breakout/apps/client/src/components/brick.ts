/**
 * A brick: the ball breaks it in `hits` hits.
 *
 * @component
 * @side client
 */
export class Brick {
  name = "Brick";

  constructor(
    /** Hits left before it breaks. */
    public hits = 1,
    /** Added to the score when it breaks. */
    public points = 10,
  ) {}
}
