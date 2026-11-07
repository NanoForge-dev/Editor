/** Docs of one param or field, as the Component panel edits them. */
export interface ParamDocs {
  readonly description?: string;
  readonly label?: string;
  readonly group?: string;
  /** `vector.x`, or `color`. */
  readonly preset?: string;
  readonly color?: string;
  readonly hidden?: boolean;
}

/** The Component panel's change: what to write in a component's doc comments. */
export interface ItemDocsOp {
  readonly export: string;
  /** The class summary. */
  readonly description?: string;
  /** Every `@group` of the header (replaces the current ones). */
  readonly groups?: readonly {
    readonly name: string;
    readonly description?: string;
    readonly color?: string;
    readonly hidden?: boolean;
  }[];
  /** The full layout of each param named here (layout tags not given are removed). */
  readonly params?: Readonly<Record<string, ParamDocs>>;
}
