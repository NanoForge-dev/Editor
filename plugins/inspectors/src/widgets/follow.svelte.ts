import type { Disposable, Observable } from '@nanoforge-dev/editor-sdk';

import type { GameSource, Inspector, Recorder } from '../recorder/recorder';

/**
 * What every inspector view needs: the engine feature while the view is on screen, a revision
 * that follows the recorder (one update per frame at most), and the game being looked at.
 */
export const follow = (recorder: Recorder, inspector: Inspector, visible: Observable<boolean>) => {
  let revision = $state(0);
  let picked = $state<GameSource>();

  $effect(() => {
    let request: Disposable | undefined;
    const stopWatching = visible.subscribe((shown) => {
      if (shown) request ??= recorder.acquire(inspector);
      else {
        request?.dispose();
        request = undefined;
      }
    });
    let frame = 0;
    const unsubscribe = recorder.revision.subscribe(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        revision++;
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      stopWatching();
      request?.dispose();
    };
  });

  return {
    get revision() {
      return revision;
    },
    get sources() {
      void revision;
      return recorder.sources;
    },
    /** The picked game, or the first one that reported something. */
    get source(): GameSource | undefined {
      void revision;
      const sources = recorder.sources;
      return picked && sources.includes(picked) ? picked : sources[0];
    },
    set source(value: GameSource | undefined) {
      picked = value;
    },
    get record() {
      void revision;
      const source = this.source;
      const record = source ? recorder.record(source) : undefined;
      return record && { ...record };
    },
  };
};
