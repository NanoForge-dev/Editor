/** Bytes of a hex string (`0a1b…`); a broken tail is dropped. */
export const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(Math.floor(hex.length / 2));
  for (let index = 0; index < bytes.length; index++) {
    const value = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    if (Number.isNaN(value)) return bytes.subarray(0, index);
    bytes[index] = value;
  }
  return bytes;
};

export type Decoded =
  | { readonly kind: 'json'; readonly text: string }
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'binary' };

/**
 * A payload as people read it: formatted JSON when it parses, text when it is valid UTF-8
 * without control characters, else binary. `complete` false means only the start of the packet
 * is known: JSON that was cut is shown as text.
 */
export const decodePayload = (bytes: Uint8Array, complete = true): Decoded => {
  if (!bytes.length) return { kind: 'binary' };
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    if (complete) return { kind: 'binary' };
    text = new TextDecoder('utf-8').decode(bytes).replace(/�+$/, '');
    if (text.includes('�')) return { kind: 'binary' };
  }
  // eslint-disable-next-line no-control-regex -- control characters mean binary data
  if (/[\x00-\x08\x0e-\x1f]/.test(text)) return { kind: 'binary' };
  if (complete) {
    try {
      const value: unknown = JSON.parse(text);
      if (value !== null && typeof value === 'object')
        return { kind: 'json', text: JSON.stringify(value, null, 2) };
    } catch {}
  }
  return { kind: 'text', text };
};

export interface DumpRow {
  /** Offset of the row, hex. */
  readonly offset: string;
  /** The bytes, two hex digits each. */
  readonly hex: readonly string[];
  /** Printable characters, `.` for the rest. */
  readonly ascii: string;
}

/** A classic hex dump, 16 bytes per row. */
export const hexDump = (bytes: Uint8Array, width = 16): DumpRow[] => {
  const rows: DumpRow[] = [];
  for (let offset = 0; offset < bytes.length; offset += width) {
    const slice = bytes.subarray(offset, offset + width);
    rows.push({
      offset: offset.toString(16).padStart(4, '0'),
      hex: Array.from(slice, (byte) => byte.toString(16).padStart(2, '0')),
      ascii: Array.from(slice, (byte) =>
        byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '.',
      ).join(''),
    });
  }
  return rows;
};

/** `512 B`, `1.5 kB`, `2.0 MB`. */
export const formatBytes = (bytes: number): string =>
  bytes < 1000
    ? `${Math.round(bytes)} B`
    : bytes < 1_000_000
      ? `${(bytes / 1000).toFixed(1)} kB`
      : `${(bytes / 1_000_000).toFixed(1)} MB`;
