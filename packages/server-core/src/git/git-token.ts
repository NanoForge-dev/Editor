export const withToken = (url: string, token: string): string => {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') return url;
  parsed.username = 'oauth2';
  parsed.password = token;
  return parsed.href;
};

/** Removes credentials from git output (clone errors echo the remote URL). */
export const redact = (text: string) => text.replace(/\/\/[^/@\s]+@/g, '//***@');
