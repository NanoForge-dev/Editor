<script lang="ts">
  import { Dialog as BitsDialog } from 'bits-ui';
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

<BitsDialog.Root
  bind:open={
    () => open,
    (next) => {
      if (!next && beforeclose?.() === false) return;
      open = next;
      if (!next) onclose?.();
    }
  }
>
  <BitsDialog.Portal>
    <BitsDialog.Overlay class="nf-dialog-overlay" />
    <BitsDialog.Content class="nf-dialog" style="width: min({width}, calc(100vw - 32px))">
      <header class="nf-dialog-header">
        <BitsDialog.Title class="nf-dialog-title">{title}</BitsDialog.Title>
        <BitsDialog.Close>
          {#snippet child({ props })}
            <IconButton {...props} icon="x" label="Close" />
          {/snippet}
        </BitsDialog.Close>
      </header>
      {#if description}<BitsDialog.Description class="nf-dialog-description"
          >{description}</BitsDialog.Description
        >{/if}
      {#if children}<div class="nf-dialog-body">{@render children()}</div>{/if}
      {#if footer}<footer class="nf-dialog-footer">{@render footer()}</footer>{/if}
    </BitsDialog.Content>
  </BitsDialog.Portal>
</BitsDialog.Root>
