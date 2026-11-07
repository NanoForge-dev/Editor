/** The text of a source file, for hashing. */
export interface HashedSource {
  readonly path: string;
  readonly text: string;
}

/**
 * `sha256-<hex>` over each source (path, NUL, text, NUL), sorted by path. Uses WebCrypto, which
 * the browser, the code worker and Bun all have.
 */
export const sourceHash = async (sources: readonly HashedSource[]): Promise<string> => {
  const sorted = [...sources].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const text = sorted.map((source) => `${source.path}\0${source.text}\0`).join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `sha256-${hex}`;
};
