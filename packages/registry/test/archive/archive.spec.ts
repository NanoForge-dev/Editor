import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { readArchive } from '../../src/archive/archive';

const CENTRAL_ENTRY = 0x02014b50;

/** A one-file stored zip whose directory claims other packed and unpacked sizes. */
const lyingZip = (packed: number, unpacked: number): Uint8Array => {
  const zip = zipSync({ 'a.txt': [strToU8('hello'), { level: 0 }] });
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  for (let offset = 0; offset < zip.length - 4; offset++) {
    if (view.getUint32(offset, true) !== CENTRAL_ENTRY) continue;
    view.setUint32(offset + 20, packed, true);
    view.setUint32(offset + 24, unpacked, true);
  }
  return zip;
};

describe('readArchive', () => {
  it('reads the files of an archive', () => {
    const files = readArchive(zipSync({ 'a.txt': strToU8('hello') }));
    expect([...files.keys()]).toEqual(['a.txt']);
  });

  it('counts what a stored entry allocates, whatever size it claims unpacked', () => {
    expect(() => readArchive(lyingZip(300 * 1024 * 1024, 0))).toThrow(/too large/);
  });
});
