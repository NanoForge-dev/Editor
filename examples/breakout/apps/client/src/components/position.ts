/**
 * Where an entity is: the top left corner of its box, in viewport pixels.
 *
 * @component
 * @side client
 */
export class Position {
  name = "Position";

  constructor(
    /** From the left. @color #f66151 */
    public x = 0,
    /** From the top. */
    public y = 0,
  ) {}
}
