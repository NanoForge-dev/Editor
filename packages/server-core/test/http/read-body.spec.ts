import { describe, expect, it } from 'vitest';

import { readBody } from '../../src/http/read-body';

const streamed = (...parts: string[]) =>
  new Request('http://localhost/rpc/x', {
    method: 'POST',
    body: new ReadableStream({
      start(controller) {
        for (const part of parts) controller.enqueue(new TextEncoder().encode(part));
        controller.close();
      },
    }),
    duplex: 'half',
  } as RequestInit);

describe('readBody', () => {
  it('reads a body within the limit', async () => {
    expect(
      await readBody(new Request('http://localhost', { method: 'POST', body: 'é{}' }), 8),
    ).toBe('é{}');
    expect(await readBody(streamed('ab', 'cd'), 4)).toBe('abcd');
  });

  it('stops at the announced length, and at the bytes counted without one', async () => {
    const announced = new Request('http://localhost', {
      method: 'POST',
      body: '0123456789',
      headers: { 'content-length': '10' },
    });
    expect(await readBody(announced, 5)).toBeUndefined();
    expect(await readBody(streamed('abc', 'def'), 5)).toBeUndefined();
  });
});
