import { readFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';

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

/** Serves a file (Bun streams it; Node reads it) with the given cache policy. */
export const fileResponse = async (
  file: string,
  cacheControl: string,
): Promise<Response | undefined> => {
  const info = await stat(file).catch(() => undefined);
  if (!info?.isFile()) return undefined;
  const headers = { 'content-type': contentType(file), 'cache-control': cacheControl };
  const bun = (globalThis as { Bun?: { file(path: string): Blob } }).Bun;
  const body = bun ? bun.file(file) : new Uint8Array(await readFile(file));
  return new Response(body, { headers });
};
