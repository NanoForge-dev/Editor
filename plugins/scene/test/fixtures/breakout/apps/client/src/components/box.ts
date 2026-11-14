/**
 * The size of an entity, for collisions.
 *
 * @component
 * @side client
 */
export class Box {
  name = "Box";

  constructor(
    /** In pixels. */
    public width = 10,
    /** In pixels. */
    public height = 10,
  ) {}
}
