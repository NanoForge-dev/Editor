import { type Disposable, toDisposable } from '@nanoforge-dev/editor-kernel';
import type { AccountSyncStore, SettingsService } from '@nanoforge-dev/editor-settings';

/**
 * Marks the page `data-nf-saved="true"` while nothing waits to be saved: no settings write or
 * debounced layout save, no account push. The e2e tests wait for it instead of sleeping.
 */
export const followSaved = (
  settings: SettingsService,
  account: AccountSyncStore,
  root: HTMLElement = document.documentElement,
): Disposable => {
  const update = () => {
    const status = account.status.get();
    const saved = settings.pending.get() === 0 && status !== 'pending' && status !== 'syncing';
    root.dataset.nfSaved = String(saved);
  };
  update();
  const stops = [settings.pending.subscribe(update), account.status.subscribe(update)];
  return toDisposable(() => {
    for (const stop of stops) stop();
    delete root.dataset.nfSaved;
  });
};
