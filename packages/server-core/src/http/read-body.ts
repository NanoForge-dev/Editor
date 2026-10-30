/** Bytes a call to `/rpc` may carry: a 64 MiB file written in base64, and the rest of the call. */
export const MAX_RPC_BODY_BYTES = 100 * 1024 * 1024;

/**
 * A request's body as text, or undefined once it is over `maxBytes` (read no further). The
 * announced length is checked first; a body without one is counted as it comes.
 */
export const readBody = async (request: Request, maxBytes: number): Promise<string | undefined> => {
  const announced = Number(request.headers.get('content-length'));
  if (Number.isFinite(announced) && announced > maxBytes) return undefined;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
};
