import { createHash } from 'node:crypto';

/**
 * Content Security Policy of the editor's page. Scripts come from the editor (and the inline
 * script SvelteKit writes, by its hash); a game played in the page may compile WebAssembly, use
 * blob and data URLs, and talk to its server on another port of this machine. Nothing else may
 * load scripts, frame the page, or receive its data.
 *
 * `games`: the page plays games (a local editor). The engine's ECS is WebAssembly built by
 * Emscripten, whose bindings compile functions from strings: such a page needs `'unsafe-eval'`.
 */
export const shellCsp = (html: string, { games = false }: { games?: boolean } = {}): string => {
  const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    ([, body]) => `'sha256-${createHash('sha256').update(body!).digest('base64')}'`,
  );
  const local = 'http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*';
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')} ${games ? "'unsafe-eval'" : "'wasm-unsafe-eval'"}`.replace(
      / {2,}/g,
      ' ',
    ),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${local}`,
    "worker-src 'self' blob: data:",
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
};
