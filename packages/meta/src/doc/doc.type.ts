export interface DocTag {
  /** Without `@`. */
  readonly name: string;
  /** The text after the tag name, trimmed (`''` for a flag). */
  readonly text: string;
}

export interface Doc {
  readonly description: string;
  readonly tags: readonly DocTag[];
}
