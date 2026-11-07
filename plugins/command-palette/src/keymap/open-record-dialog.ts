import { type ComponentProps, mount, unmount } from 'svelte';

import RecordDialog from './RecordDialog.svelte';

let current: { component: ReturnType<typeof mount>; host: HTMLElement } | undefined;

/** Closes the shortcut recorder, when it is open. */
export const closeRecordDialog = (): void => {
  if (!current) return;
  void unmount(current.component);
  current.host.remove();
  current = undefined;
};

/** Shows the dialog that records a shortcut for an action. */
export const openRecordDialog = (props: ComponentProps<typeof RecordDialog>): void => {
  closeRecordDialog();
  const host = document.createElement('div');
  document.body.append(host);
  current = { host, component: mount(RecordDialog, { target: host, props }) };
};
