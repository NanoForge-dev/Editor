<script lang="ts">
  import { untrack } from 'svelte';

  import type { GitCommit, GitStatus } from '@nanoforge-dev/editor-sdk';
  import { Icon } from '@nanoforge-dev/editor-sdk/ui';

  import { getSession } from '../../session/git-session';
  import RefLabel from './RefLabel.svelte';
  import { splitPath } from './commit-format';

  interface Props {
    status: GitStatus;
    /** The selected commit. */
    commit: GitCommit | undefined;
  }

  type ChangedFile = { path: string; change: string };

  const { status, commit }: Props = $props();
  const { api, actions: act } = getSession();

  let files = $state<{ hash: string; list: ChangedFile[] }>();
  $effect(() => {
    const hash = commit?.hash;
    if (!hash || untrack(() => files?.hash) === hash) return;
    files = undefined;
    api
      .commitFiles(act.input({ hash }))
      .catch(() => [])
      .then((list) => {
        if (commit?.hash === hash) files = { hash, list };
      });
  });

  const showFile = (file: ChangedFile) => {
    if (commit && file.change !== 'D')
      void act.compare(file.path, `${commit.hash}^`, `Before ${commit.shortHash}`);
  };
</script>

<aside class="details" aria-label="Commit details">
  {#if commit}
    <ul class="changed" aria-label="Changed files">
      {#each files?.hash === commit.hash ? files.list : [] as file (file.path)}
        {@const parts = splitPath(file.path)}
        <li>
          <button
            type="button"
            title={file.change === 'D'
              ? 'Deleted by this commit'
              : `Double-click: compare with the version before ${commit.shortHash}`}
            ondblclick={() => showFile(file)}
            onkeydown={(event) => event.key === 'Enter' && showFile(file)}
          >
            <Icon name="file-code" size={13} />
            <span class="name" data-letter={file.change}>{parts.name}</span>
            {#if parts.folder}<span class="folder">{parts.folder}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
    <div class="info">
      <h3>{commit.subject}</h3>
      <p class="meta">
        <span class="hash">{commit.shortHash}</span>
        {commit.author} on {new Date(commit.time * 1000).toLocaleString()}
      </p>
      {#if commit.refs.length}
        <p class="meta">
          {#each commit.refs as ref (ref)}
            <RefLabel {ref} {status} />
          {/each}
        </p>
      {/if}
    </div>
  {:else}
    <p class="none">Select commit to view changes</p>
  {/if}
</aside>

<style>
  .details {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .changed {
    flex: 1;
    min-height: 40px;
    overflow: auto;
    border-bottom: 1px solid var(--nf-color-border);
  }
  .changed button {
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
  .changed button:hover {
    background: var(--nf-color-hover);
  }
  .changed button:focus-visible {
    outline: 1px solid var(--nf-color-focus);
    outline-offset: -1px;
  }
  .changed button :global(svg) {
    flex: none;
    color: var(--nf-color-text-faint);
  }
  .name {
    flex: none;
    color: var(--git-modified);
  }
  .name[data-letter='A'] {
    color: var(--git-added);
  }
  .name[data-letter='D'] {
    color: var(--git-deleted);
  }
  .folder {
    min-width: 0;
    overflow: hidden;
    color: var(--nf-color-text-faint);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .info {
    flex: none;
    max-height: 45%;
    padding: var(--nf-space-2);
    overflow: auto;
  }
  h3 {
    margin: 0;
    font-size: inherit;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nf-space-1);
    margin: var(--nf-space-1) 0 0;
    color: var(--nf-color-text-muted);
  }
  .hash {
    font-family: var(--nf-font-code);
  }
  .none {
    margin: 0;
    padding: var(--nf-space-2);
    color: var(--nf-color-text-muted);
  }
</style>
