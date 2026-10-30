/**
 * Keyboard of a tab list (WAI-ARIA tabs, roving focus): the arrow keys of its orientation move
 * the focus to the previous or next tab, Home and End to the first or last; Enter or Space then
 * activates it. Returns whether the key was handled.
 */
export const moveTabFocus = (
  event: KeyboardEvent,
  orientation: 'horizontal' | 'vertical' = 'horizontal',
): boolean => {
  const [back, forward] =
    orientation === 'vertical' ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
  if (![back, forward, 'Home', 'End'].includes(event.key)) return false;
  const current = event.currentTarget as HTMLElement;
  const list = current.closest('[role="tablist"]');
  if (!list) return false;
  const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')].filter(
    (tab) => tab.closest('[role="tablist"]') === list,
  );
  const index = tabs.indexOf(current);
  if (index < 0 || !tabs.length) return false;
  const target =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (index + (event.key === forward ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault();
  tabs[target]!.focus();
  return true;
};
