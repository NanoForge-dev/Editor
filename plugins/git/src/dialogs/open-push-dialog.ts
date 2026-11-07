import { mount, unmount } from 'svelte';

import type { GitCommit } from '@nanoforge-dev/editor-sdk';

import PushDialog from './PushDialog.svelte';

let current: { component: ReturnType<typeof mount>; host: HTMLElement } | undefined;

const close = () => {
  if (!current) return;
  void unmount(current.component);
  current.host.remove();
  current = undefined;
};

/** Shows what a push would send, and pushes on confirmation (IntelliJ's Push dialog). */
export const openPushDialog = (options: {
  target: string;
  commits: Promise<readonly GitCommit[]>;
  onpush: () => void;
}): void => {
  close();
  const host = document.createElement('div');
  document.body.append(host);
  current = {
    host,
    component: mount(PushDialog, {
      target: host,
      props: {
        target: options.target,
        commits: options.commits,
        onpush: () => {
          close();
          options.onpush();
        },
        onclose: close,
      },
    }),
  };
};

export const closePushDialog = close;
