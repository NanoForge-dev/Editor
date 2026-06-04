<script lang="ts">
  import DialogName from '../dialogs/dialog-name.svelte';

  interface Props {
    name: string;
    open: boolean;
    onConfirm: (name: string) => void;
  }

  let { name, open = $bindable(false), onConfirm }: Props = $props();
</script>

<DialogName title={`Create ${name}`} nameText={`${name} name`} bind:open {onConfirm} />
