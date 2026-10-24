<script lang="ts">
  import { untrack } from 'svelte';

  import { Button, Tabs, type WidgetInstance } from '@nanoforge-dev/editor-sdk/ui';

  import { changeGroups } from '../../model/change-groups';
  import { getSession } from '../../session/git-session';
  import ConfirmDialog from '../ConfirmDialog.svelte';
  import RepositoryGate from '../RepositoryGate.svelte';
  import type { Confirmation } from '../confirmation.type';
  import ChangesTab from './ChangesTab.svelte';
  import StashTab from './StashTab.svelte';
  import { CommitPanelState } from './commit-panel-state.svelte';

  interface SavedState {
    folded?: string[];
    messages?: string[];
  }

  const { instance }: { instance: WidgetInstance } = $props();
  const { store, actions: act } = getSession();
  const git = store.state;
  // svelte-ignore state_referenced_locally
  const saved = instance.getState<SavedState>() ?? {};

  let tab = $state('commit');
  const panel = new CommitPanelState(saved);
  $effect(() => instance.setState({ folded: [...panel.folded], messages: [...panel.messages] }));
  $effect(() => {
    const status = $git.status;
    const lists = status ? changeGroups(status) : { conflicts: [], changes: [], unversioned: [] };
    untrack(() => panel.syncChecked(lists));
  });
  let confirming = $state<Confirmation>();
  const confirm = (request: Confirmation) => (confirming = request);

  const focusMessage = act.focusMessage;
  $effect(() => {
    if ($focusMessage > 0) tab = 'commit';
  });
</script>

<div class="commit-panel" aria-busy={$git.busy}>
  <RepositoryGate description="Initialize one to keep the history of your changes.">
    {#snippet actions()}
      <Button variant="primary" disabled={$git.busy} onclick={() => void act.init()}
        >Initialize repository</Button
      >
    {/snippet}
    {#snippet children(status)}
      <Tabs
        label="Commit panel"
        active={tab}
        onchange={(id) => (tab = id)}
        items={[
          { id: 'commit', label: 'Commit' },
          { id: 'stash', label: `Stash${$git.stashes.length ? ` (${$git.stashes.length})` : ''}` },
        ]}
      />
      {#if tab === 'commit'}
        <ChangesTab {status} {panel} {confirm} />
      {:else}
        <StashTab {status} {confirm} />
      {/if}
    {/snippet}
  </RepositoryGate>
</div>

<ConfirmDialog bind:request={confirming} />

<style>
  .commit-panel {
    /* File status colors, after IntelliJ's. */
    --git-modified: light-dark(#0032a0, #6897bb);
    --git-added: light-dark(#0a7700, #629755);
    --git-deleted: light-dark(#616161, #7a7a7a);
    --git-unversioned: light-dark(#993300, #d1675a);
    --git-conflict: light-dark(#d0262d, #e06c75);
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    font-size: var(--nf-font-size-sm);
  }
</style>
