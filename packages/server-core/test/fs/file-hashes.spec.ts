import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { FileHashes } from '../../src/fs/file-hashes';
import { sha1 } from '../../src/util/hash';

const dir = mkdtempSync(join(tmpdir(), 'nf-hashes-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('FileHashes', () => {
  it('keeps hashes between runs: a restarted server reads nothing again', async () => {
    const file = join(dir, 'asset.bin');
    writeFileSync(file, 'content');
    const info = statSync(file);
    const store = join(dir, 'data/file-hashes.json');
    const first = new FileHashes({ maxBytes: 1024, file: store });
    expect(await first.of(file, info)).toBe(sha1('content'));
    await first.flush();

    rmSync(file);
    const second = new FileHashes({ maxBytes: 1024, file: store });
    expect(await second.of(file, info)).toBe(sha1('content'));
  });

  it('gives no hash to a file over the limit', async () => {
    const file = join(dir, 'big.bin');
    writeFileSync(file, 'x'.repeat(2048));
    expect(await new FileHashes({ maxBytes: 1024 }).of(file, statSync(file))).toBeUndefined();
  });
});
