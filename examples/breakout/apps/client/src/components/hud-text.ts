/**
 * A text of the top bar, showing a scene var.
 *
 * @component
 * @side client
 */
export class HudText {
  name = "HudText";

  constructor(
    /** The var shown: `score`, `lives` or `level`. */
    public show: "score" | "lives" | "level" = "score",
  ) {}
}
