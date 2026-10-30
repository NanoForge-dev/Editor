import { readFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';

import { compressedFiles, isCompressible, pickEncoding } from './compressed-files';

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export const contentType = (file: string) =>
  CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';

/**
 * Serves a file (Bun streams it; Node reads it) with the given cache policy. Given the request's
 * `Accept-Encoding`, text files are sent compressed (Brotli, else gzip). With `ifNoneMatch` (the
 * request's header), the file has an ETag (its size and time) and an unchanged one comes back
 * empty (304): for `no-cache` files that change without changing their URL.
 */
export const fileResponse = async (
  file: string,
  cacheControl: string,
  acceptEncoding?: string | null,
  ifNoneMatch?: string | null,
): Promise<Response | undefined> => {
  const info = await stat(file).catch(() => undefined);
  if (!info?.isFile()) return undefined;
  const type = contentType(file);
  const headers: Record<string, string> = {
    'content-type': type,
    'cache-control': cacheControl,
    'x-content-type-options': 'nosniff',
  };
  if (ifNoneMatch !== undefined) {
    const etag = `W/"${info.size.toString(36)}-${Math.trunc(info.mtimeMs).toString(36)}"`;
    headers.etag = etag;
    if (ifNoneMatch === etag) return new Response(null, { status: 304, headers });
  }
  const encoding = acceptEncoding === undefined ? undefined : pickEncoding(acceptEncoding);
  if (acceptEncoding !== undefined) headers.vary = 'accept-encoding';
  if (encoding && isCompressible(type, info.size)) {
    const body = await compressedFiles.get(
      file,
      `${info.size}:${info.mtimeMs}`,
      encoding,
      async () => new Uint8Array(await readFile(file)),
    );
    return new Response(body as Uint8Array<ArrayBuffer>, {
      headers: { ...headers, 'content-encoding': encoding },
    });
  }
  const bun = (globalThis as { Bun?: { file(path: string): Blob } }).Bun;
  const body = bun ? bun.file(file) : new Uint8Array(await readFile(file));
  return new Response(body, { headers });
};
