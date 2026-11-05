import { createHash } from 'node:crypto';

/**
 * Content Security Policy of the editor's page. Scripts come from the editor (and the inline
 * script SvelteKit writes, by its hash); nothing else may load scripts or frame the page. Images
 * may come from any https origin; a hosted page connects to its own origin only.
 *
 * `games`: the page plays games (a local editor). A game may compile WebAssembly, use blob and
 * data URLs, and connect anywhere (its server on another port, or online services). The engine's
 * ECS is WebAssembly built by Emscripten, whose bindings compile functions from strings: such a
 * page needs `'unsafe-eval'`.
 */
export const shellCsp = (html: string, { games = false }: { games?: boolean } = {}): string => {
  const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    ([, body]) => `'sha256-${createHash('sha256').update(body!).digest('base64')}'`,
  );
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
    `connect-src 'self'${games ? ' http: https: ws: wss:' : ''}`,
    "worker-src 'self' blob: data:",
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
};
