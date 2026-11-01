import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

  it('keeps one hash per file, and saves nothing when a hash did not change', async () => {
    const file = join(dir, 'edited.ts');
    const store = join(dir, 'one-per-file/file-hashes.json');
    const hashes = new FileHashes({ maxBytes: 1024, file: store });
    writeFileSync(file, 'one');
    await hashes.of(file, statSync(file));
    writeFileSync(file, 'two, longer');
    const info = statSync(file);
    expect(await hashes.of(file, info)).toBe(sha1('two, longer'));
    await hashes.flush();
    expect(JSON.parse(readFileSync(store, 'utf8'))).toHaveLength(1);

    rmSync(store);
    hashes.remember(file, info, sha1('two, longer'));
    await hashes.of(file, info);
    await hashes.flush();
    expect(existsSync(store)).toBe(false);
  });

  it('forgets the least recently used hash first', async () => {
    const file = join(dir, 'used.ts');
    writeFileSync(file, 'used');
    const info = statSync(file);
    const hashes = new FileHashes({ maxBytes: 1024 });
    hashes.remember(file, info, 'remembered');
    for (let index = 1; index < 50_000; index++)
      hashes.remember(join(dir, `other-${index}`), info, 'other');
    expect(await hashes.of(file, info)).toBe('remembered');
    hashes.remember(join(dir, 'one-more'), info, 'other');
    expect(await hashes.of(file, info)).toBe('remembered');
  });
});
