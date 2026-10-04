import {
  EditorServices,
  ObservableValue,
  type ProjectFs,
  type ServiceAccessor,
} from '@nanoforge-dev/editor-sdk';
import { NotificationServiceToken, PromptServiceToken } from '@nanoforge-dev/editor-sdk/ui';

import { openPushDialog } from '../dialogs/open-push-dialog';
import type { GitRpc } from '../session/git-session';
import type { GitStore } from '../store/git-store';

const BRANCH_NAME = /^(?!-)(?!.*\.\.)[^\s~^:?*[\\]+$/;

export interface CommitRequest {
  readonly message: string;
  /** Files to commit; undefined commits what is staged (a merge). */
  readonly paths?: readonly string[];
  readonly amend?: boolean;
  /** Push once committed. */
  readonly push?: boolean;
}

/**
 * What the VCS menu, the Commit panel and the Git panel do: each runs a git operation of the
 * open project, reports a failure with git's own message, and refreshes the panels.
 */
export const createActions = (options: {
  services: ServiceAccessor;
  store: GitStore;
  api: GitRpc;
  project: () => string | undefined;
  /** Files of the open project. */
  fs: () => ProjectFs | undefined;
}) => {
  const { services, store, api } = options;
  const input = <T extends object>(extra?: T) =>
    ({ project: options.project() ?? '', ...extra }) as T & { project: string };
  const notify = (kind: 'info' | 'warning', title: string, detail?: string) =>
    services.tryGet(NotificationServiceToken)?.notify(kind, title, detail ? { detail } : {});
  const commands = services.get(EditorServices.Commands);
  /** Untracked folders are listed as `folder/`: the server takes paths without the slash. */
  const clean = (paths: readonly string[]) => paths.map((path) => path.replace(/\/$/, ''));
  /** Asks the Commit panel to focus its message box (bumped by `Commit…`). */
  const focusMessage = new ObservableValue(0);

  const actions = {
    input,
    focusMessage: focusMessage.readonly(),

    init: () => store.run('Could not initialize the repository', () => api.init(input())),
    fetch: () => store.run('Could not fetch', () => api.fetch(input())),
    /** Pushes at once (after the Push dialog's confirmation). */
    pushNow: () => store.run('Could not push', () => api.push(input())),
    /** Push…: shows the commits a push would send, and pushes on confirmation. */
    push: () => {
      const status = store.state.get().status;
      const branch = status?.branch ?? 'HEAD';
      openPushDialog({
        target: `${branch} → ${status?.upstream ?? `origin/${branch}`}`,
        commits: api.outgoing(input()),
        onpush: () => void actions.pushNow(),
      });
      return Promise.resolve(true);
    },

    /** Update project: a merge pull. Conflicts are listed in the Commit panel. */
    pull: async () => {
      let conflicts = false;
      const done = await store.run('Could not update the project', async () => {
        conflicts = (await api.pull(input())).conflicts;
      });
      if (done && conflicts) {
        notify(
          'warning',
          'The update stopped on conflicts',
          'Fix the files under Merge conflicts in the Commit panel, mark them resolved, then commit.',
        );
        await commands.execute('workbench.openWidget', 'git.changes');
      }
      return done;
    },

    commit: async ({ message, paths, amend = false, push = false }: CommitRequest) => {
      const done = await store.run('Could not commit', () =>
        api.commit(input({ message, amend, all: false, ...(paths && { paths: clean(paths) }) })),
      );
      return done && push ? actions.push() : done;
    },

    /** Opens the Commit panel with the focus in its message box. */
    showCommit: async () => {
      await commands.execute('workbench.openWidget', 'git.changes');
      focusMessage.set(focusMessage.get() + 1);
    },
    showLog: () => commands.execute('workbench.openWidget', 'git.log'),

    rollback: (paths: readonly string[]) =>
      store.run('Could not roll back', () => api.discard(input({ paths: clean(paths) }))),
    /** Add to VCS: git starts tracking the files (they move from Unversioned to Changes). */
    add: (paths: readonly string[]) =>
      store.run('Could not add the files', () => api.stage(input({ paths: clean(paths) }))),
    /** Appends the paths to the project's `.gitignore`. */
    ignore: (paths: readonly string[]) =>
      store.run('Could not write .gitignore', async () => {
        const fs = options.fs();
        if (!fs) throw new Error('No project is open');
        const current = fs.entry('.gitignore') ? (await fs.readText('.gitignore')).text : '';
        const lines = clean(paths).map((path) => `/${path}`);
        const text = `${current}${current && !current.endsWith('\n') ? '\n' : ''}${lines.join('\n')}\n`;
        await fs.write('.gitignore', text);
      }),
    markResolved: (path: string) =>
      store.run('Could not mark the file resolved', () =>
        api.stage(input({ paths: clean([path]) })),
      ),

    /** Asks for a name and creates a branch at the current commit, or from a branch. */
    newBranch: async (from?: string) => {
      const name = await services.get(PromptServiceToken).ask({
        title: from ? `New branch from ${from}` : 'New branch',
        label: 'Branch name',
        confirm: 'Create branch',
        validate: (value) =>
          BRANCH_NAME.test(value) ? undefined : 'This is not a valid branch name',
      });
      return name
        ? store.run('Could not create the branch', () =>
            api.createBranch(input({ name, ...(from && { from }) })),
          )
        : false;
    },
    checkout: (name: string) =>
      store.run('Could not check out the branch', () => api.switchBranch(input({ name }))),
    /** Deletes a branch; rejects with git's message when it is not merged and `force` is off. */
    deleteBranch: async (name: string, force: boolean) => {
      await api.deleteBranch(input({ name, force }));
      await store.refresh();
    },

    stash: async () => {
      const text = await services.get(PromptServiceToken).ask({
        title: 'Stash changes',
        label: 'Message (optional)',
        confirm: 'Stash',
      });
      if (text === undefined) return false;
      const message = text.trim();
      return store.run('Could not stash', () => api.stash(input(message ? { message } : {})));
    },
    applyStash: (index: number, pop: boolean) =>
      store.run(pop ? 'Could not pop the stash' : 'Could not apply the stash', () =>
        api.applyStash(input({ index, pop })),
      ),
    dropStash: (index: number) =>
      store.run('Could not drop the stash', () => api.dropStash(input({ index }))),

    /** Shows a file next to an earlier version of it, in the code editor. */
    compare: async (path: string, revision: string, label: string) => {
      await store.run(`Could not compare ${path}`, async () => {
        const text = await api.show(input({ path, revision }));
        await commands.execute('codeEditor.compare', path, {
          text: text ?? '',
          label: text === null ? `${label} (the file did not exist)` : label,
        });
      });
    },
    open: (path: string) => commands.execute('documents.open', path),
    info: (title: string) => notify('info', title),
  };
  return actions;
};

export type GitActions = ReturnType<typeof createActions>;
