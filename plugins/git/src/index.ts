import type { Component } from 'svelte';

import {
  EditorServices,
  ProjectServiceToken,
  RpcClientToken,
  definePlugin,
  derived,
} from '@nanoforge-dev/editor-sdk';
import {
  FILE_DECORATIONS,
  MENU_BAR,
  NotificationServiceToken,
  STATUS_BAR_ITEMS,
  StyleServiceToken,
  WIDGET_VIEWS,
  type WidgetInstance,
  registerIcons,
} from '@nanoforge-dev/editor-sdk/ui';

import { createActions } from './actions/create-actions';
import { closePushDialog } from './dialogs/open-push-dialog';
import { ICONS } from './icons';
import { branchLabel } from './model/branch-label';
import { decorationOf } from './model/file-decoration';
import { gitApi, setSession } from './session/git-session';
import { GitStore } from './store/git-store';
import CommitView from './widgets/commit/CommitView.svelte';
import LogView from './widgets/log/LogView.svelte';

export default definePlugin({
  async activate(context) {
    const { services } = context;
    const css = await fetch(context.resolveAsset('git.css')).then((response) =>
      response.ok ? response.text() : '',
    );
    context.subscriptions.add(services.get(StyleServiceToken).inject(context.name, css));
    context.subscriptions.add(registerIcons(ICONS));

    const api = gitApi(services.get(RpcClientToken));
    const projects = services.get(ProjectServiceToken);
    const contextKeys = services.get(EditorServices.ContextKeys);
    const store = new GitStore((title, error) =>
      services.tryGet(NotificationServiceToken)?.notify('error', title, {
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
    context.subscriptions.add(store);
    const actions = createActions({
      services,
      store,
      api,
      project: () => projects.current.get()?.id,
      fs: () => projects.current.get()?.fs,
    });
    setSession({ store, api, actions });
    context.subscriptions.add({ dispose: () => setSession(undefined) });
    context.subscriptions.add({ dispose: closePushDialog });

    let stopWatching: (() => void) | undefined;
    context.subscriptions.add({
      dispose: projects.current.subscribe((project) => {
        stopWatching?.();
        stopWatching = undefined;
        if (!project) {
          store.setApi(undefined);
          return;
        }
        const input = { project: project.id };
        store.setApi({
          status: () => api.status(input),
          branches: () => api.branches(input),
          stashes: () => api.stashes(input),
          log: (limit, branch) => api.log({ ...input, limit, ...(branch && { branch }) }),
        });
        const watching = project.fs.onDidChange(() => store.schedule());
        stopWatching = () => watching.dispose();
      }),
    });
    context.subscriptions.add({ dispose: () => stopWatching?.() });
    const onFocus = () => store.schedule();
    window.addEventListener('focus', onFocus);
    context.subscriptions.add({ dispose: () => window.removeEventListener('focus', onFocus) });

    context.subscriptions.add({
      dispose: store.state.subscribe(({ status }) =>
        contextKeys.set('git.repository', status?.repository === true),
      ),
    });

    for (const [id, component] of [
      ['git.changes', CommitView],
      ['git.log', LogView],
    ] as const) {
      context.subscriptions.add(
        context.contribute(WIDGET_VIEWS, {
          id,
          component: component as unknown as Component<{ instance: WidgetInstance }>,
        }),
      );
    }
    context.subscriptions.add(
      context.contribute(STATUS_BAR_ITEMS, {
        id: 'git.branch',
        alignment: 'left',
        order: 3,
        when: 'git.repository',
        text: derived([store.state], ({ status }) => branchLabel(status)),
        tooltip: 'Show branches and history',
        command: 'git.showLog',
      }),
    );
    context.subscriptions.add(context.contribute(MENU_BAR, { id: 'vcs', title: 'VCS', order: 4 }));
    context.subscriptions.add(
      context.contribute(FILE_DECORATIONS, {
        id: 'git.status',
        changes: store.state,
        decorate: (path, kind) => decorationOf(store.state.get().status, path, kind),
      }),
    );

    for (const [id, run] of [
      ['git.init', actions.init],
      ['git.commit', actions.showCommit],
      ['git.pull', actions.pull],
      ['git.push', actions.push],
      ['git.fetch', actions.fetch],
      ['git.newBranch', () => actions.newBranch()],
      ['git.stash', actions.stash],
      ['git.showLog', actions.showLog],
      ['git.refresh', () => store.refresh()],
    ] as const) {
      context.subscriptions.add(context.registerCommand(id, () => run()));
    }
  },
});
