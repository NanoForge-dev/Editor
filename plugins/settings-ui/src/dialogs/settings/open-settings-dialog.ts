import { mount, unmount } from 'svelte';

import type { ServiceAccessor } from '@nanoforge-dev/editor-sdk';

import SettingsDialog from './SettingsDialog.svelte';

let current: { component: ReturnType<typeof mount>; host: HTMLElement } | undefined;

/** Closes the Settings dialog, when it is open. */
export const closeSettingsDialog = (): void => {
  if (!current) return;
  void unmount(current.component);
  current.host.remove();
  current = undefined;
};

/** Shows the Settings dialog, on a page when one is given (a category id, `plugins`…). */
export const openSettingsDialog = (services: ServiceAccessor, page?: unknown): void => {
  closeSettingsDialog();
  const host = document.createElement('div');
  document.body.append(host);
  current = {
    host,
    component: mount(SettingsDialog, {
      target: host,
      props: {
        services,
        ...(typeof page === 'string' && { page }),
        onclose: closeSettingsDialog,
      },
    }),
  };
};
