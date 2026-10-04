import { describe, expect, it } from 'vitest';

import { decodePayload, formatBytes, hexDump, hexToBytes } from '../../src/network/packets';

const bytesOf = (text: string) => new TextEncoder().encode(text);

describe('packets', () => {
  it('reads hex', () => {
    expect([...hexToBytes('00ff10')]).toEqual([0, 255, 16]);
    expect([...hexToBytes('0a1')]).toEqual([10]);
    expect([...hexToBytes('0azz')]).toEqual([10]);
  });

  it('decodes JSON, text and binary payloads', () => {
    expect(decodePayload(bytesOf('{"type":"play","n":1}'))).toEqual({
      kind: 'json',
      text: '{\n  "type": "play",\n  "n": 1\n}',
    });
    expect(decodePayload(bytesOf('hello é'))).toEqual({ kind: 'text', text: 'hello é' });
    expect(decodePayload(bytesOf('42'))).toEqual({ kind: 'text', text: '42' });
    expect(decodePayload(new Uint8Array([0, 1, 2, 255]))).toEqual({ kind: 'binary' });
    expect(decodePayload(new Uint8Array([0xff, 0xfe]))).toEqual({ kind: 'binary' });
    expect(decodePayload(new Uint8Array())).toEqual({ kind: 'binary' });
  });

  it('shows a cut payload as text, even cut inside a character', () => {
    expect(decodePayload(bytesOf('{"type":"pl'), false)).toEqual({
      kind: 'text',
      text: '{"type":"pl',
    });
    const cut = bytesOf('abé').subarray(0, 3);
    expect(decodePayload(cut, false)).toEqual({ kind: 'text', text: 'ab' });
    expect(decodePayload(cut, true)).toEqual({ kind: 'binary' });
  });

  it('dumps bytes in rows with offsets and printable characters', () => {
    const rows = hexDump(bytesOf('Hello, NanoForge!\n'));
    expect(rows).toEqual([
      {
        offset: '0000',
        hex: '48 65 6c 6c 6f 2c 20 4e 61 6e 6f 46 6f 72 67 65'.split(' '),
        ascii: 'Hello, NanoForge',
      },
      { offset: '0010', hex: ['21', '0a'], ascii: '!.' },
    ]);
  });

  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1500)).toBe('1.5 kB');
    expect(formatBytes(2_000_000)).toBe('2.0 MB');
  });
});
