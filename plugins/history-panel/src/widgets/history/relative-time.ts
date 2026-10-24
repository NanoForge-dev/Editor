/** "just now", "2 min ago", "3 h ago", then the date. */
export const relativeTime = (time: number, now = Date.now()): string => {
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  if (seconds < 30) return 'just now';
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h ago`;
  return new Date(time).toLocaleDateString();
};
