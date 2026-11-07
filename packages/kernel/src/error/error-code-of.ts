/** The code of an editor error (an RPC error, or anything with a string `code`). */
export const errorCodeOf = (error: unknown): string | undefined => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
};
