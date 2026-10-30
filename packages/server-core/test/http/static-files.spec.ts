import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';

import { pickEncoding } from '../../src/http/compressed-files';
import { fileResponse } from '../../src/http/static-files';

const dir = mkdtempSync(join(tmpdir(), 'nf-static-'));
const script = join(dir, 'app.js');
const text = `export const values = [${Array.from({ length: 400 }, (_, i) => i).join(', ')}];\n`;
writeFileSync(script, text);
const image = join(dir, 'logo.png');
writeFileSync(image, new Uint8Array(4096));
const small = join(dir, 'small.js');
writeFileSync(small, 'export {};\n');

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('pickEncoding', () => {
  it('prefers Brotli, then gzip, and honors q=0', () => {
    expect(pickEncoding('gzip, deflate, br, zstd')).toBe('br');
    expect(pickEncoding('gzip;q=1.0, br;q=0')).toBe('gzip');
    expect(pickEncoding('identity')).toBeUndefined();
    expect(pickEncoding(null)).toBeUndefined();
  });
});

describe('fileResponse', () => {
  it('sends text compressed when the client accepts it', async () => {
    const br = (await fileResponse(script, 'no-cache', 'gzip, br'))!;
    expect(br.headers.get('content-encoding')).toBe('br');
    expect(br.headers.get('vary')).toBe('accept-encoding');
    const brBytes = new Uint8Array(await br.arrayBuffer());
    expect(brBytes.byteLength).toBeLessThan(text.length / 2);
    expect(brotliDecompressSync(brBytes).toString()).toBe(text);

    const gz = (await fileResponse(script, 'no-cache', 'gzip'))!;
    expect(gz.headers.get('content-encoding')).toBe('gzip');
    expect(gunzipSync(new Uint8Array(await gz.arrayBuffer())).toString()).toBe(text);
  });

  it('sends as is: images, small files, and files of callers that do not compress', async () => {
    for (const response of [
      await fileResponse(image, 'no-cache', 'br'),
      await fileResponse(small, 'no-cache', 'br'),
      await fileResponse(script, 'no-cache'),
    ]) {
      expect(response!.headers.get('content-encoding')).toBeNull();
    }
    expect(await (await fileResponse(script, 'no-cache', 'identity'))!.text()).toBe(text);
  });
});
