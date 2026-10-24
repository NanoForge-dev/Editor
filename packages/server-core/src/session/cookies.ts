import { createHmac, timingSafeEqual } from 'node:crypto';

export const parseCookies = (header: string | null | undefined): Record<string, string> => {
  const cookies: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      cookies[name] = part.slice(index + 1).trim();
    }
  }
  return cookies;
};

export interface CookieOptions {
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  path?: string;
  domain?: string;
}

export const serializeCookie = (name: string, value: string, options: CookieOptions = {}) =>
  [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path ?? '/'}`,
    options.maxAge !== undefined && `Max-Age=${options.maxAge}`,
    options.domain && `Domain=${options.domain}`,
    options.httpOnly !== false && 'HttpOnly',
    options.secure && 'Secure',
    `SameSite=${options.sameSite ?? 'Lax'}`,
  ]
    .filter(Boolean)
    .join('; ');

const signature = (value: string, secret: string) =>
  createHmac('sha256', secret).update(value).digest('base64url');

export const sign = (value: string, secret: string): string =>
  `${value}.${signature(value, secret)}`;

/** Returns the signed value, or undefined when the signature does not match. */
export const unsign = (signed: string, secret: string): string | undefined => {
  const index = signed.lastIndexOf('.');
  if (index <= 0) return undefined;
  const value = signed.slice(0, index);
  const expected = Buffer.from(signature(value, secret));
  const actual = Buffer.from(signed.slice(index + 1));
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? value : undefined;
};
