/** A destructive action waiting for the user's confirmation. */
export interface Confirmation {
  readonly title: string;
  readonly description: string;
  /** The label of the button that runs it. */
  readonly confirm: string;
  readonly run: () => void;
}
