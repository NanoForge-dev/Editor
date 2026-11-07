export interface ErrorAction {
  readonly label: string;
  readonly run: () => void | Promise<void>;
  readonly primary?: boolean;
}

export interface ErrorDescription {
  readonly title: string;
  readonly hint?: string;
  /** Technical detail, shown small (the raw message). */
  readonly detail?: string;
  readonly actions: readonly ErrorAction[];
}

export const errorMessage = (reason: unknown): string =>
  reason instanceof Error ? reason.message : String(reason);
