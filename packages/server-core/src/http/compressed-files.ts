import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

const brotli = promisify(brotliCompress);
const gzipped = promisify(gzip);

/** Types worth compressing: text, json, wasm, svg. Images and fonts are compressed already. */
const COMPRESSIBLE = /^(text\/|application\/(json|wasm)|image\/svg\+xml)/;
/** Below this size, the headers outweigh what compressing saves. */
const MIN_BYTES = 1024;
/** Compressed files kept in memory, the oldest dropped first past this total. */
const MAX_CACHED_BYTES = 64 * 1024 * 1024;

export type Encoding = 'br' | 'gzip';

/** A quality of zero (`q=0`, `q=0.0`, `q=0.000`) refuses the encoding. */
const refused = (quality: string | undefined): boolean => {
  const match = /^q\s*=\s*([\d.]+)$/i.exec(quality?.trim() ?? '');
  return match !== null && parseFloat(match[1]!) === 0;
};

/** The encoding to answer with, from the request's `Accept-Encoding`. */
export const pickEncoding = (accept: string | null | undefined): Encoding | undefined => {
  const offered = (accept ?? '')
    .split(',')
    .map((part) => part.trim().split(';'))
    .filter(([, quality]) => !refused(quality))
    .map(([name]) => name!.trim().toLowerCase());
  if (offered.includes('br')) return 'br';
  if (offered.includes('gzip')) return 'gzip';
  return undefined;
};

export const isCompressible = (contentType: string, size: number): boolean =>
  size >= MIN_BYTES && COMPRESSIBLE.test(contentType);

/**
 * Compresses files once per version (path, size and modification time) and keeps the result:
 * the editor's bundles and plugins are served many times and never change while it runs.
 */
export class CompressedFiles {
  private readonly _cache = new Map<string, Promise<Uint8Array>>();
  private readonly _sizes = new Map<string, number>();
  private _bytes = 0;

  get(
    file: string,
    version: string,
    encoding: Encoding,
    read: () => Promise<Uint8Array>,
  ): Promise<Uint8Array> {
    const key = `${encoding}\0${file}\0${version}`;
    let compressed = this._cache.get(key);
    if (!compressed) {
      compressed = read().then((bytes) =>
        encoding === 'br'
          ? brotli(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
          : gzipped(bytes),
      );
      this._cache.set(key, compressed);
      compressed.then(
        (bytes) => this._keep(key, bytes.byteLength),
        () => this._cache.delete(key),
      );
    }
    return compressed.then((bytes) => new Uint8Array(bytes));
  }

  private _keep(key: string, size: number): void {
    if (!this._cache.has(key)) return;
    this._sizes.set(key, size);
    this._bytes += size;
    for (const [oldest, bytes] of this._sizes) {
      if (this._bytes <= MAX_CACHED_BYTES || oldest === key) break;
      this._cache.delete(oldest);
      this._sizes.delete(oldest);
      this._bytes -= bytes;
    }
  }
}

export const compressedFiles = new CompressedFiles();
