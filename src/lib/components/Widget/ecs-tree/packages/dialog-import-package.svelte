<script lang="ts">
  import DialogName from '../dialogs/dialog-name.svelte';

  interface Props {
    name: string;
    open: boolean;
    onConfirm: (name: string) => void;
  }

  let { name, open = $bindable(false), onConfirm }: Props = $props();
</script>

<DialogName
  title={`Import ${name}`}
  nameText={`${name} name`}
  confirmText="Import"
  bind:open
  {onConfirm}
/>
