<script lang="ts">
  import DialogNamePath from '../dialogs/dialog-name-path.svelte';

  interface Props {
    name: string;
    open: boolean;
    onConfirm: (name: string, path: string) => void;
  }

  let { name, open = $bindable(false), onConfirm }: Props = $props();
</script>

<DialogNamePath
  title={`Import ${name}`}
  nameText={`${name} name`}
  confirmText="Import"
  bind:open
  {onConfirm}
/>
