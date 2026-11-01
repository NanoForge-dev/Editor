import type { z } from 'zod';

import type { TourTargetSchema } from './tour.extension-point';

/** Elements that have a role without saying it (the roles tours point at). */
const IMPLICIT: Record<string, string> = {
  button: 'button:not([role]), input[type="button"]:not([role]), input[type="submit"]:not([role])',
  link: 'a[href]:not([role])',
  textbox:
    'input:not([type]):not([role]), input[type="text"]:not([role]), input[type="search"]:not([role]), textarea:not([role])',
  checkbox: 'input[type="checkbox"]:not([role])',
  navigation: 'nav:not([role])',
  region: 'section[aria-label]:not([role]), section[aria-labelledby]:not([role])',
  heading: 'h1:not([role]), h2:not([role]), h3:not([role]), h4:not([role])',
  complementary: 'aside:not([role])',
};

/** The accessible name of an element, near enough: label, labelledby, then its text. */
export const accessibleName = (element: Element): string => {
  const label = element.getAttribute('aria-label');
  if (label) return label.trim();
  const ids = element.getAttribute('aria-labelledby');
  if (ids)
    return ids
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim() ?? '')
      .join(' ')
      .trim();
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
};

const visible = (element: Element) =>
  element.getClientRects().length > 0 &&
  !element.closest('[inert], [hidden], [aria-hidden="true"]');

const byRole = (
  root: ParentNode,
  role: string,
  name: string,
  exact = true,
): HTMLElement | undefined => {
  const selector = [`[role="${role}"]`, IMPLICIT[role]].filter(Boolean).join(', ');
  const matches = (actual: string) =>
    actual === name || (!exact && actual.startsWith(name) && /^\W/.test(actual.slice(name.length)));
  return [...root.querySelectorAll<HTMLElement>(selector)].find(
    (element) => visible(element) && matches(accessibleName(element)),
  );
};

/** The element a step points at, when it is on screen. */
export const findTarget = (
  target: z.input<typeof TourTargetSchema>,
  root: ParentNode = document,
): HTMLElement | undefined => {
  const scope = target.within ? byRole(root, target.within.role, target.within.name) : root;
  return scope ? byRole(scope, target.role, target.name, target.exact) : undefined;
};
