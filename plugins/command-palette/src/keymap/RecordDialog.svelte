<script lang="ts">
  import { parseWhen } from '@nanoforge-dev/editor-sdk';
  import {
    Button,
    Dialog,
    Input,
    type KeybindingService,
    formatKeybinding,
    portableStroke,
    strokeFromEvent,
  } from '@nanoforge-dev/editor-sdk/ui';

  export interface RecordedShortcut {
    readonly key: string;
    readonly when: string | undefined;
    /** The actions in conflict lose this shortcut. */
    readonly replace: boolean;
  }

  interface Props {
    /** The action the shortcut is for, as shown in the list. */
    action: string;
    /** The shortcut being changed, if any. */
    initial?: { key: string; when?: string | undefined };
    /** Shortcuts of other actions that this one would get in the way of. */
    conflictsFor: (key: string, when: string | undefined) => { action: string; key: string }[];
    /** Turned off while recording, so every key reaches the recorder. */
    keybindings?: KeybindingService | undefined;
    onsave: (shortcut: RecordedShortcut) => void;
    oncancel: () => void;
  }

  // svelte-ignore state_referenced_locally
  const { action, initial, conflictsFor, keybindings, onsave, oncancel }: Props = $props();

  let open = $state(true);
  // svelte-ignore state_referenced_locally
  let strokes = $state<string[]>(initial?.key.trim().split(/\s+/).filter(Boolean) ?? []);
  // svelte-ignore state_referenced_locally
  let when = $state(initial?.when ?? '');
  let recorder = $state<HTMLElement>();

  $effect(() => {
    const suspended = keybindings?.suspend();
    return () => suspended?.dispose();
  });
  $effect(() => recorder?.focus());

  const key = $derived(strokes.join(' '));
  const invalidWhen = $derived.by(() => {
    if (!when.trim()) return undefined;
    try {
      parseWhen(when);
      return undefined;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  });
  const conflicts = $derived(
    key && !invalidWhen ? conflictsFor(key, when.trim() || undefined) : [],
  );
  const ready = $derived(strokes.length > 0 && !invalidWhen);

  const save = (replace: boolean) => {
    if (!ready) return;
    open = false;
    onsave({ key, when: when.trim() || undefined, replace });
  };

  const record = (event: KeyboardEvent) => {
    if (event.key === 'Tab') return;
    const plain = !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey;
    if (plain && event.key === 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    if (plain && event.key === 'Enter' && strokes.length) {
      if (!conflicts.length) save(false);
      return;
    }
    if (plain && event.key === 'Backspace' && strokes.length) {
      strokes = [];
      return;
    }
    const stroke = strokeFromEvent(event);
    if (!stroke) return;
    strokes = strokes.length >= 2 ? [portableStroke(stroke)] : [...strokes, portableStroke(stroke)];
  };
</script>

<Dialog
  bind:open
  title={`Shortcut for ${action}`}
  description="Press the keys. A second keystroke makes a chord. Backspace clears, Enter saves."
  onclose={oncancel}
>
  <div class="record">
    <div
      class="keys"
      class:empty={!strokes.length}
      bind:this={recorder}
      role="textbox"
      aria-label="Shortcut"
      aria-readonly="true"
      tabindex="0"
      onkeydown={record}
    >
      {strokes.length ? formatKeybinding(key) : 'Press a shortcut'}
    </div>
    <label class="condition">
      <span>Condition (optional)</span>
      <Input
        bind:value={when}
        aria-label="Condition"
        placeholder="For example: runtime.active"
        invalid={!!invalidWhen}
      />
    </label>
    {#if invalidWhen}
      <p class="problem" role="alert">This condition can't be read: {invalidWhen}</p>
    {/if}
    {#if conflicts.length}
      <div class="conflicts" role="alert">
        <p>Already used by:</p>
        <ul>
          {#each conflicts as conflict, index (index)}
            <li>{conflict.action} <kbd>{formatKeybinding(conflict.key)}</kbd></li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
  {#snippet footer()}
    <Button
      onclick={() => {
        open = false;
        oncancel();
      }}>Cancel</Button
    >
    {#if conflicts.length}
      <Button disabled={!ready} onclick={() => save(false)}>Keep both</Button>
      <Button variant="primary" disabled={!ready} onclick={() => save(true)}>Replace</Button>
    {:else}
      <Button variant="primary" disabled={!ready} onclick={() => save(false)}>Save shortcut</Button>
    {/if}
  {/snippet}
</Dialog>

<style>
  .record {
    display: flex;
    flex-direction: column;
    gap: var(--nf-space-3);
  }
  .keys {
    display: grid;
    place-items: center;
    min-height: 56px;
    border: 1px solid var(--nf-color-border-strong);
    border-radius: var(--nf-radius-control);
    background: var(--nf-color-sunken);
    font-family: var(--nf-font-code);
    font-size: var(--nf-font-size-lg, 16px);
  }
  .keys:focus {
    outline: 2px solid var(--nf-color-focus);
    outline-offset: 1px;
  }
  .keys.empty {
    color: var(--nf-color-text-faint);
    font-family: inherit;
  }
  .condition {
    display: flex;
    flex-direction: column;
    gap: var(--nf-space-1);
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .problem,
  .conflicts p {
    margin: 0;
  }
  .problem {
    color: var(--nf-color-danger);
    font-size: var(--nf-font-size-sm);
  }
  .conflicts {
    padding: var(--nf-space-2) var(--nf-space-3);
    border: 1px solid var(--nf-color-warning);
    border-radius: var(--nf-radius-control);
    font-size: var(--nf-font-size-sm);
  }
  .conflicts ul {
    margin: var(--nf-space-1) 0 0;
    padding-left: var(--nf-space-4);
  }
  kbd {
    margin-left: var(--nf-space-1);
    font-family: var(--nf-font-code);
  }
</style>
