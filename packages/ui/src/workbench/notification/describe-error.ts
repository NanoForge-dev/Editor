import type { NotificationAction, NotificationService } from './notification-service';

/** An error said in plain words, with what can be done about it. */
export interface ErrorExplanation {
  /** What happened, for anyone (`undefined`: the raw message is already plain). */
  readonly hint: string | undefined;
  /** The raw message, kept for Show details. */
  readonly technical: string;
  /** Whether trying the same thing again may work (the server was away, a request timed out). */
  readonly retryable: boolean;
}

/**
 * Codes whose raw message is technical. The others (CONFLICT, FORBIDDEN, NOT_FOUND…) carry the
 * server's own words, already plain and more precise than a hint per code would be ("Already
 * exists: a.ts", "Permission denied: b.ts"): they are shown as they are.
 */
const HINTS: Record<string, { hint: string; retryable: boolean }> = {
  UNAVAILABLE: {
    hint: "The editor server can't be reached. Your changes are kept: try again once it is back.",
    retryable: true,
  },
  TIMEOUT: { hint: 'The editor server took too long to answer.', retryable: true },
  UNAUTHORIZED: { hint: 'Your session expired: sign in again.', retryable: false },
  INTERNAL: {
    hint: 'Something went wrong in the editor server. Show details tells what.',
    retryable: false,
  },
};

/** The code of an editor error (an RPC error, or anything with a `code`). */
export const errorCodeOf = (error: unknown): string | undefined => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
};

export const describeError = (error: unknown): ErrorExplanation => {
  const technical = error instanceof Error ? error.message : String(error);
  const known = HINTS[errorCodeOf(error) ?? ''];
  return { hint: known?.hint, technical, retryable: known?.retryable ?? false };
};

/**
 * Shows an error as a sentence and what to do: `title` says what failed, the explanation why;
 * the raw message stays behind Show details. `retry` is offered only when the error says trying
 * again may work, and only if the operation is safe to repeat (the caller decides).
 */
export const notifyError = (
  notifications: NotificationService | undefined,
  title: string,
  error: unknown,
  options: {
    readonly retry?: () => void | Promise<void>;
    readonly actions?: readonly NotificationAction[];
  } = {},
): void => {
  const { hint, technical, retryable } = describeError(error);
  notifications?.notify('error', title, {
    ...(hint ? { detail: hint, technical } : { detail: technical }),
    actions: [
      ...(retryable && options.retry ? [{ title: 'Try again', run: options.retry }] : []),
      ...(options.actions ?? []),
    ],
  });
};
