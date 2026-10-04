<script lang="ts">
  import { getSession } from '../../session/git-session';
  import ConfirmDialog from '../ConfirmDialog.svelte';
  import RepositoryGate from '../RepositoryGate.svelte';
  import type { Confirmation } from '../confirmation.type';
  import BranchTree from './BranchTree.svelte';
  import CommitDetails from './CommitDetails.svelte';
  import CommitTable from './CommitTable.svelte';

  const git = getSession().store.state;

  let selectedHash = $state<string>();
  const selected = $derived($git.log.find((commit) => commit.hash === selectedHash));
  let confirming = $state<Confirmation>();
</script>

<div class="log-panel" aria-busy={$git.busy}>
  <RepositoryGate description="Initialize one from the Commit panel or the VCS menu.">
    {#snippet children(status)}
      <BranchTree {status} confirm={(request) => (confirming = request)} />
      <CommitTable {status} bind:selectedHash />
      <CommitDetails {status} commit={selected} />
    {/snippet}
  </RepositoryGate>
</div>

<ConfirmDialog bind:request={confirming} />

<style>
  .log-panel {
    --git-modified: light-dark(#0032a0, #6897bb);
    --git-added: light-dark(#0a7700, #629755);
    --git-deleted: light-dark(#616161, #7a7a7a);
    /* Reference labels, after IntelliJ's: current head, local, remote, tag. */
    --ref-head: light-dark(#8a6d00, #e8bf6a);
    --ref-local: light-dark(#0a7700, #6aab73);
    --ref-remote: light-dark(#6f42c1, #b189f5);
    --ref-tag: light-dark(#616161, #9e9e9e);
    display: grid;
    grid-template-columns: minmax(160px, 230px) minmax(0, 3fr) minmax(220px, 2fr);
    height: 100%;
    min-height: 0;
    font-size: var(--nf-font-size-sm);
  }
  .log-panel > :global(.empty) {
    grid-column: 1 / -1;
  }
</style>
