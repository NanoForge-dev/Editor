import type { EditorEnv } from '../env/editor-env.type';

const LOOPBACK = /^(localhost|.+\.localhost|127(\.\d{1,3}){3}|\[::1\])$/;
const WILDCARD_HOSTS = new Set(['0.0.0.0', '::', '[::]']);

const hostname = (host: string): string => {
  const lower = host.trim().toLowerCase();
  if (lower.startsWith('[')) return lower.slice(0, lower.indexOf(']') + 1);
  return lower.replace(/:\d+$/, '');
};

/**
 * Whether the `Host` header names this server. A page whose name was rebound to 127.0.0.1 sends
 * its own name as `Host` (and as `Origin`, so the origin check alone passes): a local editor only
 * answers to loopback names and `ALLOWED_HOSTS`. A hosted one checks `ALLOWED_HOSTS` when set.
 */
export const hostAllowed = (env: EditorEnv, host: string | null): boolean => {
  if (!host) return false;
  const name = hostname(host);
  const allowed = [
    ...env.allowedHosts,
    ...env.allowedOrigins.flatMap((origin) => {
      try {
        return [new URL(origin).hostname.toLowerCase()];
      } catch {
        return [];
      }
    }),
    ...(WILDCARD_HOSTS.has(env.host) ? [] : [env.host.toLowerCase()]),
  ];
  if (LOOPBACK.test(name) || allowed.includes(name)) return true;
  return env.mode === 'ONLINE' && !env.allowedHosts.length;
};

/**
 * Whether a browser request comes from the editor's own pages. Requests without `Origin`
 * (navigations, non-browser clients) pass, except cross-site subresource loads.
 */
export const originAllowed = (env: EditorEnv, request: Request): boolean => {
  const origin = request.headers.get('origin');
  if (!origin) {
    const site = request.headers.get('sec-fetch-site');
    return site !== 'cross-site' || request.headers.get('sec-fetch-mode') === 'navigate';
  }
  const host = request.headers.get('host') ?? new URL(request.url).host;
  try {
    return new URL(origin).host === host || env.allowedOrigins.includes(origin);
  } catch {
    return false;
  }
};
