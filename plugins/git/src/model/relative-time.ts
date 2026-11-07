/** `3 min ago`, `2 days ago`, from seconds since epoch. */
export const relativeTime = (seconds: number, now = Date.now()): string => {
  const elapsed = Math.max(Math.round(now / 1000 - seconds), 0);
  const units: [number, string][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [30, 'day'],
    [12, 'month'],
    [Infinity, 'year'],
  ];
  let value = elapsed;
  for (const [size, unit] of units) {
    if (value < size) {
      if (unit === 'second') return 'just now';
      return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
    }
    value = Math.floor(value / size);
  }
  return '';
};
