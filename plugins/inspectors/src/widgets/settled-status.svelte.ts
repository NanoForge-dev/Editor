/**
 * Text for a live region that changes with live data (counts of packets or entities): it is
 * taken only once the user's filters have rested for `delay` ms, never at the data's own rate,
 * so screen readers say the result of a search instead of every update.
 */
export const settledStatus = (filters: () => unknown, text: () => string, delay = 600) => {
  let value = $state('');
  let first = true;
  $effect(() => {
    filters();
    if (first) {
      first = false;
      return;
    }
    const timer = setTimeout(() => (value = text()), delay);
    return () => clearTimeout(timer);
  });
  return {
    get text() {
      return value;
    },
  };
};
