import { ObservableValue } from '@nanoforge-dev/editor-sdk';
import type { RuntimeService } from '@nanoforge-dev/editor-sdk';

/** The window the game was moved to, if any. */
export const popout = new ObservableValue<Window | undefined>(undefined);

const FORWARDED = ['keydown', 'keyup'] as const;

/**
 * Moves the running game into a new browser window (same page realm: the game keeps running).
 * Keys typed there are forwarded to the editor window, where the engine listens. Closing the
 * window brings the game back (the Game screen re-attaches it).
 */
export const popOut = (runtime: RuntimeService, title: string): boolean => {
  if (popout.get()) {
    popout.get()!.focus();
    return true;
  }
  const opened = window.open('', 'nanoforge-game', 'popup,width=1280,height=760');
  if (!opened) return false;
  const doc = opened.document;
  doc.title = title;
  doc.body.style.cssText = 'margin:0;background:#000;overflow:hidden';
  const host = doc.createElement('div');
  host.style.cssText = 'position:fixed;inset:0';
  doc.body.append(host);
  for (const type of FORWARDED) {
    opened.addEventListener(type, (event) => {
      window.dispatchEvent(new KeyboardEvent(type, event));
    });
  }
  const view = runtime.attach(host);
  popout.set(opened);
  const back = () => {
    if (popout.get() !== opened) return;
    view.dispose();
    popout.set(undefined);
  };
  opened.addEventListener('pagehide', back);
  const timer = setInterval(() => {
    if (opened.closed) {
      clearInterval(timer);
      back();
    }
  }, 500);
  return true;
};

/** Brings a popped out game back (closes its window). */
export const bringBack = (): void => {
  const opened = popout.get();
  popout.set(undefined);
  opened?.close();
};
