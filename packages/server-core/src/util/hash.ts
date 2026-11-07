import { createHash } from 'node:crypto';

export const sha1 = (content: Uint8Array | string): string =>
  createHash('sha1').update(content).digest('hex');

export const shortHash = (value: string, length = 16): string =>
  createHash('sha256').update(value).digest('hex').slice(0, length);
