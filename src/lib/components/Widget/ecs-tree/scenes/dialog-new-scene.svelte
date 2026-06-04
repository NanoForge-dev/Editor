<script lang="ts">
  import DialogName from '../dialogs/dialog-name.svelte';

  interface Props {
    open: boolean;
    onConfirm: (name: string) => void;
  }

  let { open = $bindable(false), onConfirm }: Props = $props();
</script>

<DialogName title="New Scene" nameText="Scene name" bind:open {onConfirm} />
