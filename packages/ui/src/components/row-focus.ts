/**
 * Keyboard of a list of rows with one Tab stop (a grid's rows): Up and Down move the focus to
 * the previous or next row, Home and End to the first or last. Returns the index of the row
 * focused, for the caller to select it, or undefined when the key is not one of these.
 */
export const moveRowFocus = (event: KeyboardEvent): { index: number } | undefined => {
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return undefined;
  const current = event.currentTarget as HTMLElement;
  const rows = [...(current.parentElement?.children ?? [])].filter(
    (row): row is HTMLElement => row instanceof HTMLElement,
  );
  const index = rows.indexOf(current);
  if (index < 0) return undefined;
  const target =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? rows.length - 1
        : Math.min(rows.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)));
  event.preventDefault();
  rows[target]!.focus();
  return { index: target };
};
