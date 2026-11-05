import { describe, expect, it } from 'vitest';

import { decodeRuntimeApp, runtimeOutputPath } from '../../src/runtime/runtime-output';

describe('runtimeOutputPath', () => {
  it('keeps the app segment of a single-app project once a browser resolves the URL', () => {
    const base = new URL(runtimeOutputPath('p1', ''), 'http://127.0.0.1');
    const file = new URL('main.js', base);
    const [, , project, app] = file.pathname.split('/');
    expect(project).toBe('p1');
    expect(decodeRuntimeApp(app!)).toBe('');
    expect(file.pathname.split('/')).toHaveLength(5);
  });

  it('round-trips app ids', () => {
    const path = runtimeOutputPath('p1', 'apps/client');
    expect(decodeRuntimeApp(path.split('/')[3]!)).toBe('apps/client');
  });
});
