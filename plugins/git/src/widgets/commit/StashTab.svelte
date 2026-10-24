<script lang="ts">
  import type { GitStatus } from '@nanoforge-dev/editor-sdk';
  import { Button } from '@nanoforge-dev/editor-sdk/ui';

  import { getSession } from '../../session/git-session';
  import type { Confirmation } from '../confirmation.type';

  interface Props {
    status: GitStatus;
    confirm: (request: Confirmation) => void;
  }

  const { status, confirm }: Props = $props();
  const { store, actions: act } = getSession();
  const git = store.state;
  const hasChanges = $derived(status.files.some((file) => !file.conflicted));
</script>

<div class="toolbar" role="toolbar" aria-label="Stashes">
  <Button
    size="sm"
    variant="ghost"
    disabled={$git.busy || !hasChanges}
    onclick={() => void act.stash()}>Stash Changes</Button
  >
</div>
<ul class="scroll" aria-label="Stashes">
  {#each $git.stashes as entry (entry.index)}
    <li class="stash" aria-label={entry.message}>
      <span class="name">{entry.message}</span>
      <Button size="sm" variant="ghost" onclick={() => void act.applyStash(entry.index, false)}
        >Apply</Button
      >
      <Button size="sm" variant="ghost" onclick={() => void act.applyStash(entry.index, true)}
        >Pop</Button
      >
      <Button
        size="sm"
        variant="ghost"
        onclick={() =>
          confirm({
            title: 'Drop this stash?',
            description: `"${entry.message}" will be lost. This cannot be undone.`,
            confirm: 'Drop',
            run: () => void act.dropStash(entry.index),
          })}>Drop</Button
      >
    </li>
  {:else}
    <li class="none">No stash.</li>
  {/each}
</ul>

<style>
  .toolbar {
    display: flex;
    flex: none;
    gap: var(--nf-space-1);
    align-items: center;
    padding: 2px var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
  }
  .scroll {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: 0;
    overflow: auto;
    list-style: none;
  }
  li {
    display: flex;
    gap: var(--nf-space-1);
    align-items: center;
    padding: 2px var(--nf-space-2) 2px var(--nf-space-3);
    cursor: default;
    user-select: none;
    white-space: nowrap;
  }
  li:hover {
    background: var(--nf-color-hover);
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .none {
    padding: var(--nf-space-2) var(--nf-space-4);
    color: var(--nf-color-text-faint);
  }
</style>
