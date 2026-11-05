/**
 * Whether a `contextmenu` event comes from the keyboard (the menu key, Shift+F10), aimed at the
 * focused element rather than at what is under the pointer. Browsers fire it as a pointer event
 * with no pointer type; older ones as a mouse event whose button is not the right one.
 */
export const isKeyboardMenu = (event: MouseEvent): boolean =>
  typeof PointerEvent !== 'undefined' && event instanceof PointerEvent
    ? event.pointerType === ''
    : event.button !== 2;
