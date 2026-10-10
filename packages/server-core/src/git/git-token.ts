/**
 * Environment that makes git send `token` to `url`'s host as basic credentials (GitHub and GitLab
 * style), through `GIT_CONFIG_*`: nothing on the command line, nothing saved in the clone.
 */
export const authEnv = (url: string, token: string | undefined): Record<string, string> => {
  if (!token || !URL.canParse(url)) return {};
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') return {};
  const credentials = Buffer.from(`oauth2:${token}`).toString('base64');
  return {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `http.${parsed.origin}/.extraHeader`,
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${credentials}`,
  };
};

/** `url` without the user and password older clones kept in their remote. */
export const withoutCredentials = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (!parsed.username && !parsed.password) return url;
    parsed.username = '';
    parsed.password = '';
    return parsed.href;
  } catch {
    return url;
  }
};

/** Removes credentials from git output (clone errors echo the remote URL). */
export const redact = (text: string) => text.replace(/\/\/[^/@\s]+@/g, '//***@');
