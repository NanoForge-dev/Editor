export const getUrl = (url: string, query?: Record<string, any>) => {
  const entries = Object.entries(query ?? {}).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return url;
  return `${url}?${new URLSearchParams(entries).toString()}`;
};
