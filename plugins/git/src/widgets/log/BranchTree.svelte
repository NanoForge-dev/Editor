<script lang="ts">
  import type { GitBranch, GitStatus } from '@nanoforge-dev/editor-sdk';
  import {
    ContextMenu,
    Icon,
    IconButton,
    Input,
    type MenuEntry,
  } from '@nanoforge-dev/editor-sdk/ui';

  import { branchGroups } from '../../model/branch-groups';
  import { getSession } from '../../session/git-session';
  import type { Confirmation } from '../confirmation.type';

  interface Props {
    status: GitStatus;
    confirm: (request: Confirmation) => void;
  }

  const { status, confirm }: Props = $props();
  const { store, actions: act } = getSession();
  const git = store.state;
  const busy = $derived($git.busy);

  let branchQuery = $state('');
  let foldedNodes = $state<readonly string[]>([]);
  let selectedBranch = $state<string>();
  const branchNeedle = $derived(branchQuery.trim().toLowerCase());
  const tree = $derived.by(() => {
    const { local, remote } = branchGroups(
      $git.branches.filter((branch) => branch.name.toLowerCase().includes(branchNeedle)),
    );
    const remotes: Record<string, GitBranch[]> = {};
    for (const branch of remote) {
      const name = branch.name.slice(0, branch.name.indexOf('/'));
      (remotes[name] ??= []).push(branch);
    }
    return { local, remotes: Object.entries(remotes) };
  });
  const shownBranch = $derived($git.logBranch ?? status.branch);
  const toggleNode = (id: string) => {
    foldedNodes = foldedNodes.includes(id)
      ? foldedNodes.filter((other) => other !== id)
      : [...foldedNodes, id];
  };
  const pick = (branch: GitBranch) => {
    selectedBranch = branch.name;
    void store.showBranch(branch.current ? undefined : branch.name);
  };
  const selectedBranchEntry = $derived($git.branches.find((b) => b.name === selectedBranch));

  const remove = (branch: GitBranch) => {
    const force = () =>
      void store.run('Could not delete the branch', () => act.deleteBranch(branch.name, true));
    confirm({
      title: `Delete the branch ${branch.name}?`,
      description: 'Its commits stay in the repository only if another branch has them.',
      confirm: 'Delete',
      run: () =>
        void act.deleteBranch(branch.name, false).catch((error: unknown) => {
          if (/not fully merged/.test(String((error as Error).message))) {
            confirm({
              title: `${branch.name} is not merged`,
              description: 'Deleting it loses the commits that only this branch has.',
              confirm: 'Delete anyway',
              run: force,
            });
          } else void store.run('Could not delete the branch', () => Promise.reject(error));
        }),
    });
  };
  let menuBranch: GitBranch | undefined;
  const branchMenu = (): MenuEntry[] => {
    const branch = menuBranch;
    if (!branch) return [];
    return [
      {
        kind: 'item',
        id: 'checkout',
        label: 'Checkout',
        disabled: branch.current,
        onSelect: () => void act.checkout(branch.name),
      },
      {
        kind: 'item',
        id: 'new',
        label: `New Branch from '${branch.name}'…`,
        onSelect: () => void act.newBranch(branch.name),
      },
      { kind: 'separator' },
      {
        kind: 'item',
        id: 'update',
        label: 'Update',
        disabled: !branch.current,
        onSelect: () => void act.pull(),
      },
      {
        kind: 'item',
        id: 'push',
        label: 'Push…',
        disabled: !branch.current,
        onSelect: () => void act.push(),
      },
      { kind: 'separator' },
      {
        kind: 'item',
        id: 'delete',
        label: 'Delete',
        disabled: branch.current || branch.remote,
        onSelect: () => remove(branch),
      },
    ];
  };
</script>

{#snippet branchRow(branch: GitBranch, label: string)}
  <li>
    <button
      type="button"
      class="branch"
      class:current={branch.current}
      class:selected={selectedBranch === branch.name}
      aria-current={branch.name === shownBranch ? 'true' : undefined}
      title={branch.current ? 'The current branch' : 'Double-click to check it out'}
      onclick={() => pick(branch)}
      ondblclick={() => !branch.current && void act.checkout(branch.name)}
      oncontextmenu={() => {
        menuBranch = branch;
        selectedBranch = branch.name;
      }}
    >
      <Icon name={branch.current ? 'tag' : 'git-branch'} size={12} />
      <span class="label">{label}</span>
    </button>
  </li>
{/snippet}

{#snippet node(id: string, title: string)}
  <button
    type="button"
    class="node"
    aria-expanded={!foldedNodes.includes(id)}
    onclick={() => toggleNode(id)}
  >
    <Icon name={foldedNodes.includes(id) ? 'chevron-right' : 'chevron-down'} size={12} />
    {title}
  </button>
{/snippet}

<nav class="branches" aria-label="Branches">
  <div class="toolbar" role="toolbar" aria-label="Branch actions">
    <IconButton
      icon="plus"
      size={14}
      label="New Branch"
      onclick={() => void act.newBranch(selectedBranchEntry?.name)}
    />
    <IconButton
      icon="arrow-down-to-line"
      size={14}
      label="Update Selected"
      disabled={busy}
      onclick={() => void act.pull()}
    />
    <IconButton
      icon="trash-2"
      size={14}
      label="Delete Branch"
      disabled={!selectedBranchEntry || selectedBranchEntry.current || selectedBranchEntry.remote}
      onclick={() => selectedBranchEntry && remove(selectedBranchEntry)}
    />
    <IconButton
      icon="refresh-cw"
      size={14}
      label="Fetch All Remotes"
      disabled={busy}
      onclick={() => void act.fetch()}
    />
    <IconButton
      icon="arrow-up-from-line"
      size={14}
      label="Push"
      disabled={busy}
      onclick={() => void act.push()}
    />
  </div>
  <div class="search">
    <Input bind:value={branchQuery} placeholder="Search branches" aria-label="Search branches" />
  </div>
  <ContextMenu items={branchMenu}>
    <div class="tree">
      <button
        type="button"
        class="branch head"
        aria-current={!$git.logBranch ? 'true' : undefined}
        onclick={() => {
          selectedBranch = status.branch;
          void store.showBranch(undefined);
        }}
      >
        <Icon name="tag" size={12} />
        <span class="label">HEAD (Current Branch)</span>
      </button>
      {@render node('local', 'Local')}
      {#if !foldedNodes.includes('local')}
        <ul aria-label="Local branches">
          {#each tree.local as branch (branch.name)}
            {@render branchRow(branch, branch.name)}
          {/each}
        </ul>
      {/if}
      {#if tree.remotes.length}
        {@render node('remote', 'Remote')}
        {#if !foldedNodes.includes('remote')}
          {#each tree.remotes as [remote, list] (remote)}
            <p class="remote">{remote}</p>
            <ul aria-label={`Branches of ${remote}`}>
              {#each list as branch (branch.name)}
                {@render branchRow(branch, branch.name.slice(remote.length + 1))}
              {/each}
            </ul>
          {/each}
        {/if}
      {/if}
    </div>
  </ContextMenu>
</nav>

<style>
  .branches {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    border-right: 1px solid var(--nf-color-border);
  }
  .toolbar {
    display: flex;
    flex: none;
    gap: var(--nf-space-1);
    align-items: center;
    padding: 2px var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
  }
  .search {
    flex: none;
    padding: var(--nf-space-1) var(--nf-space-2);
  }
  .search :global(input) {
    width: 100%;
  }
  .tree {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .node,
  .branch {
    display: flex;
    gap: var(--nf-space-1);
    align-items: center;
    width: 100%;
    padding: 2px var(--nf-space-2);
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: default;
    user-select: none;
  }
  .node {
    color: var(--nf-color-text-muted);
    cursor: pointer;
  }
  .branch {
    padding-left: var(--nf-space-4);
  }
  .branch.head {
    padding-left: var(--nf-space-2);
  }
  .remote {
    margin: 0;
    padding: 2px var(--nf-space-2) 2px var(--nf-space-4);
    color: var(--nf-color-text-faint);
  }
  ul[aria-label^='Branches of'] .branch {
    padding-left: calc(var(--nf-space-4) + var(--nf-space-3));
  }
  .branch:hover,
  .node:hover {
    background: var(--nf-color-hover);
  }
  .branch[aria-current='true'] {
    background: var(--nf-color-pressed);
  }
  .branch.selected {
    background: var(--nf-color-selection);
    color: var(--nf-color-selection-text);
  }
  .branch.current .label {
    font-weight: 600;
  }
  .node:focus-visible,
  .branch:focus-visible {
    outline: 1px solid var(--nf-color-focus);
    outline-offset: -1px;
  }
  .label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
