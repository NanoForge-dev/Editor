import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { shellCsp } from '../../src/http/shell-csp';

describe('shellCsp', () => {
  it('lets the page run its own inline scripts by hash, and nothing from elsewhere', () => {
    const inline = '\n\t\t\t{ __sveltekit = {}; }\n\t\t';
    const policy = shellCsp(
      `<html><head><script>${inline}</script><script type="module" src="/_app/x.js"></script></head></html>`,
    );
    const hash = createHash('sha256').update(inline).digest('base64');
    const directives = Object.fromEntries(
      policy.split('; ').map((directive) => {
        const [name, ...values] = directive.split(' ');
        return [name, values];
      }),
    );
    expect(directives['script-src']).toEqual(["'self'", `'sha256-${hash}'`, "'wasm-unsafe-eval'"]);
    expect(directives['connect-src']).toContain('ws://localhost:*');
    expect(directives['frame-ancestors']).toEqual(["'self'"]);
    expect(directives['default-src']).toEqual(["'self'"]);
  });

  it('lets a local editor play games, whose WebAssembly bindings compile strings', () => {
    expect(shellCsp('', { games: true })).toContain("script-src 'self' 'unsafe-eval'");
    expect(shellCsp('')).not.toContain("'unsafe-eval'");
  });
});
