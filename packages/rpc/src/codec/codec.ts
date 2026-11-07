/**
 * JSON with a binary-safe envelope: `Uint8Array`/`ArrayBuffer` become `{ "$bin": base64 }` and
 * `Date` becomes `{ "$date": iso }`, so file contents can travel through JSON RPC calls.
 */
const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const fromBase64 = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const isPlainTagged = (value: unknown, tag: string): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  Object.keys(value).length === 1 &&
  typeof (value as Record<string, unknown>)[tag] === 'string';

export const encode = (value: unknown): string =>
  JSON.stringify(value, function (this: Record<string, unknown>, key, current: unknown) {
    const raw = this[key];
    if (raw instanceof Date) return { $date: raw.toISOString() };
    if (current instanceof Uint8Array) return { $bin: toBase64(current) };
    if (current instanceof ArrayBuffer) return { $bin: toBase64(new Uint8Array(current)) };
    return current;
  });

export const decode = <T = unknown>(text: string): T =>
  JSON.parse(text, (_key, value: unknown) => {
    if (isPlainTagged(value, '$bin')) return fromBase64(value.$bin!);
    if (isPlainTagged(value, '$date')) return new Date(value.$date!);
    return value;
  }) as T;
