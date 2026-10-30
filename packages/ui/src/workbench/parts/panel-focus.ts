const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const byInstance = (selector: string, instanceId: string) =>
  document.querySelector<HTMLElement>(selector.replace('$', CSS.escape(instanceId)));

/** Focuses an element, making it focusable from code first when it is not. */
const focus = (element: HTMLElement) => {
  if (!element.matches(FOCUSABLE) && !element.hasAttribute('tabindex')) element.tabIndex = -1;
  element.focus();
};

/**
 * Moves the focus into a panel once it is on screen (opened from the keyboard): its first
 * focusable element, else the panel itself.
 */
export const focusPanel = (instanceId: string): void => {
  requestAnimationFrame(() => {
    const host = byInstance('[data-nf-instance="$"]', instanceId);
    if (host) focus(host.querySelector<HTMLElement>(FOCUSABLE) ?? host);
  });
};

/**
 * Gives the focus somewhere sensible after a panel was hidden or closed, instead of letting it
 * fall to the page: its tool-window icon when it still has one, else the main screen.
 */
export const focusAfterPanel = (instanceId: string): void => {
  requestAnimationFrame(() => {
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    const target =
      byInstance('[data-nf-part="stripe"] [role="tab"][data-instance="$"]', instanceId) ??
      document.querySelector<HTMLElement>('[data-nf-part="screen"]');
    if (target) focus(target);
  });
};
