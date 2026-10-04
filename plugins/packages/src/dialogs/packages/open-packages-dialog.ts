import { mount, unmount } from 'svelte';

import type { ServiceAccessor } from '@nanoforge-dev/editor-sdk';

import PackagesDialog from './PackagesDialog.svelte';

let current: { component: ReturnType<typeof mount>; host: HTMLElement } | undefined;

/** Closes the Packages dialog, when it is open. */
export const closePackagesDialog = (): void => {
  if (!current) return;
  void unmount(current.component);
  current.host.remove();
  current = undefined;
};

/** Shows the Packages dialog (File › Packages…), on a tab when one is given. */
export const openPackagesDialog = (services: ServiceAccessor, tab?: unknown): void => {
  closePackagesDialog();
  const host = document.createElement('div');
  document.body.append(host);
  current = {
    host,
    component: mount(PackagesDialog, {
      target: host,
      props: {
        services,
        ...((tab === 'browse' || tab === 'installed') && { tab }),
        onclose: closePackagesDialog,
      },
    }),
  };
};
