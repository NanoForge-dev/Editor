<script lang="ts">
  import { untrack } from 'svelte';

  import type { GitStatus } from '@nanoforge-dev/editor-sdk';
  import { Button, Checkbox, IconButton, Menu, type MenuEntry } from '@nanoforge-dev/editor-sdk/ui';

  import { getSession } from '../../session/git-session';
  import type { CommitPanelState } from './commit-panel-state.svelte';

  interface Props {
    status: GitStatus;
    /** The paths the commit takes. */
    included: readonly string[];
    /** Whether conflicts are left: nothing can be committed until they are resolved. */
    conflicted: boolean;
    panel: CommitPanelState;
  }

  const { status, included, conflicted, panel }: Props = $props();
  const { store, actions: act } = getSession();
  const git = store.state;

  let messageBox = $state<HTMLTextAreaElement>();

  const focusMessage = act.focusMessage;
  $effect(() => {
    if ($focusMessage > 0) messageBox?.focus();
  });

  $effect(() => {
    if (panel.amend && !untrack(() => panel.message.trim()))
      panel.message = untrack(() => $git.log[0]?.subject ?? '');
  });

  const merging = $derived(status.merging);
  const canCommit = $derived(
    !$git.busy &&
      panel.message.trim() !== '' &&
      !conflicted &&
      (merging || panel.amend || included.length > 0),
  );
  const commit = async (push: boolean) => {
    if (!canCommit) return;
    const text = panel.message.trim();
    const done = await act.commit({
      message: text,
      ...(!merging && { paths: included }),
      amend: panel.amend,
      push,
    });
    if (done) {
      panel.remember(text);
      panel.message = '';
      panel.amend = false;
    }
  };
  const messageHistory = $derived<MenuEntry[]>(
    panel.messages.length
      ? panel.messages.map((text, index) => ({
          kind: 'item',
          id: String(index),
          label: text.split('\n')[0]!.slice(0, 80),
          onSelect: () => (panel.message = text),
        }))
      : [{ kind: 'item', id: 'none', label: 'No message yet', disabled: true, onSelect: () => {} }],
  );
</script>

<div class="message">
  <div class="options">
    <Checkbox bind:checked={panel.amend} label="Amend" />
    <span class="grow"></span>
    <Menu items={messageHistory} align="end">
      {#snippet trigger({ props })}
        <IconButton {...props} icon="history" size={14} label="Commit Message History" />
      {/snippet}
    </Menu>
  </div>
  <textarea
    bind:this={messageBox}
    bind:value={panel.message}
    rows="3"
    aria-label="Commit message"
    placeholder="Commit Message"
    onkeydown={(event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void commit(false);
      }
    }}></textarea>
  <div class="buttons">
    <Button variant="primary" size="sm" disabled={!canCommit} onclick={() => void commit(false)}
      >Commit</Button
    >
    <Button size="sm" disabled={!canCommit} onclick={() => void commit(true)}
      >Commit and Push…</Button
    >
  </div>
</div>

<style>
  .message {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: var(--nf-space-1);
    padding: var(--nf-space-1) var(--nf-space-2) var(--nf-space-2);
    border-top: 1px solid var(--nf-color-border);
  }
  .options {
    display: flex;
    align-items: center;
  }
  .grow {
    flex: 1;
  }
  textarea {
    padding: var(--nf-space-1) var(--nf-space-2);
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-control);
    background: var(--nf-color-sunken);
    color: var(--nf-color-text);
    font: inherit;
    resize: vertical;
  }
  textarea:focus-visible {
    outline: 1px solid var(--nf-color-focus);
  }
  .buttons {
    display: flex;
    gap: var(--nf-space-2);
  }
</style>
