/** Who made a change: undo only ever targets changes of the local user. */
export interface CommandOrigin {
  readonly kind: 'user' | 'plugin' | 'remote';
  readonly id: string;
}

type MaybePromise<T> = T | Promise<T>;

/** An undoable change. `do` runs once when pushed; `redo` defaults to `do`. */
export interface HistoryCommand {
  readonly label: string;
  /** Defaults to the local user of the history service. */
  readonly origin?: CommandOrigin;
  /** Approximate memory held by the command (snapshots…), for the stack memory budget. */
  readonly sizeBytes?: number;
  /** Commands with the same key pushed within the merge window become one step. */
  readonly mergeKey?: string;
  /** What changed, for the history panel (e.g. the lines of a document edit). */
  readonly preview?: CommandPreview;
  /** Steps of a grouped command (transactions). */
  readonly children?: readonly HistoryCommand[];
  do(): MaybePromise<void>;
  undo(): MaybePromise<void>;
  redo?(): MaybePromise<void>;
  /**
   * Merges a following command into this one. Returns the merged command, or undefined when
   * they cannot merge. Without it, commands with the same `mergeKey` merge by keeping this
   * command's `undo` and the next one's `redo`.
   */
  merge?(next: HistoryCommand): HistoryCommand | undefined;
  /** Checked before undo/redo; false means the state it relies on changed (step dropped). */
  isValid?(): MaybePromise<boolean>;
  /** Called when the command leaves the history (trimmed, cleared, invalidated). */
  dispose?(): void;
  /** Data to rebuild the command after a reload (see `HistoryService.registerDeserializer`). */
  serialize?(): SerializedCommand | undefined;
}

/** Before/after text of a change (a few lines around it). */
export interface CommandPreview {
  readonly title?: string;
  readonly before: string;
  readonly after: string;
}

export interface SerializedCommand {
  /** Deserializer type (`document.edits`…). */
  readonly type: string;
  readonly label: string;
  readonly data: unknown;
}
