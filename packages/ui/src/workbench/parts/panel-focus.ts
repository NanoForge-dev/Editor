/** What the keyboard can reach: enabled controls, links and tab stops, but not roving rows. */
const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]',
]
  .map((selector) => `${selector}:not([tabindex="-1"])`)
  .join(', ');

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
      byInstance('[data-nf-stripe] [role="tab"][data-instance="$"]', instanceId) ??
      document.querySelector<HTMLElement>('[data-nf-part="screen"]');
    if (target) focus(target);
  });
};

/**
 * F6 / Shift+F6: focuses the first focusable element on screen of the next (or previous) visible
 * part, else that part itself. Hidden screens stay mounted, so elements of a hidden subtree are
 * skipped.
 */
export const focusNextPart = (root: HTMLElement, direction: 1 | -1): void => {
  const parts = [...root.querySelectorAll<HTMLElement>('[data-nf-part]')].filter((part) =>
    part.checkVisibility(),
  );
  if (!parts.length) return;
  const current = parts.findIndex((part) => part.contains(document.activeElement));
  const index = current < 0 ? (direction > 0 ? 0 : parts.length - 1) : current + direction;
  const next = parts[(index + parts.length) % parts.length]!;
  const target = [...next.querySelectorAll<HTMLElement>(FOCUSABLE)].find((element) =>
    element.checkVisibility(),
  );
  focus(target ?? next);
};
