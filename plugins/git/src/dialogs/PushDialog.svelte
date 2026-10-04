<script lang="ts">
  import type { GitCommit } from '@nanoforge-dev/editor-sdk';
  import { Button, Dialog } from '@nanoforge-dev/editor-sdk/ui';

  interface Props {
    /** `main → origin : main`. */
    target: string;
    /** The commits the push sends; undefined while they are read. */
    commits: Promise<readonly GitCommit[]>;
    onpush: () => void;
    onclose: () => void;
  }

  const given: Props = $props();
  // svelte-ignore state_referenced_locally
  const [target, commits, onpush, onclose] = [
    given.target,
    given.commits,
    given.onpush,
    given.onclose,
  ];
  let open = $state(true);
</script>

<Dialog bind:open title="Push commits" description={target} {onclose}>
  {#await commits}
    <p class="note">Reading the commits to push…</p>
  {:then list}
    {#if list.length}
      <ul aria-label="Commits to push">
        {#each list as commit (commit.hash)}
          <li>
            <span class="subject">{commit.subject}</span>
            <span class="meta">{commit.author} · {commit.shortHash}</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="note">Everything is already pushed.</p>
    {/if}
  {:catch}
    <p class="note">The commits could not be read. You can still push.</p>
  {/await}
  {#snippet footer()}
    <Button
      onclick={() => {
        open = false;
        onclose();
      }}>Cancel</Button
    >
    <Button
      variant="primary"
      onclick={() => {
        open = false;
        onpush();
      }}>Push</Button
    >
  {/snippet}
</Dialog>

<style>
  ul {
    max-height: 40vh;
    margin: 0;
    padding: 0;
    overflow: auto;
    list-style: none;
  }
  li {
    display: flex;
    gap: var(--nf-space-3);
    justify-content: space-between;
    padding: 2px 0;
  }
  .subject {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta,
  .note {
    flex: none;
    margin: 0;
    color: var(--nf-color-text-muted);
  }
</style>
