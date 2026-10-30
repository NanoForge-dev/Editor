<script lang="ts">
  import { Dialog } from 'bits-ui';
  import type { Snippet } from 'svelte';

  import IconButton from './icon-button.svelte';

  interface Props {
    open: boolean;
    title: string;
    description?: string;
    children?: Snippet;
    footer?: Snippet;
    onclose?: () => void;
    /**
     * Asked before Escape, the close button or a click outside close the dialog: `false` keeps it
     * open (unsaved changes to confirm first).
     */
    beforeclose?: () => boolean;
    width?: string;
  }

  let {
    open = $bindable(),
    title,
    description,
    children,
    footer,
    onclose,
    beforeclose,
    width = '480px',
  }: Props = $props();
</script>

<Dialog.Root
  bind:open={
    () => open,
    (next) => {
      if (!next && beforeclose?.() === false) return;
      open = next;
      if (!next) onclose?.();
    }
  }
>
  <Dialog.Portal>
    <Dialog.Overlay class="nf-dialog-overlay" />
    <Dialog.Content class="nf-dialog" style="width: min({width}, calc(100vw - 32px))">
      <header class="nf-dialog-header">
        <Dialog.Title class="nf-dialog-title">{title}</Dialog.Title>
        <Dialog.Close>
          {#snippet child({ props })}
            <IconButton {...props} icon="x" label="Close" />
          {/snippet}
        </Dialog.Close>
      </header>
      {#if description}<Dialog.Description class="nf-dialog-description"
          >{description}</Dialog.Description
        >{/if}
      {#if children}<div class="nf-dialog-body">{@render children()}</div>{/if}
      {#if footer}<footer class="nf-dialog-footer">{@render footer()}</footer>{/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
