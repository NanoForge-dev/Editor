<script lang="ts">
  import DialogName from '../dialogs/dialog-name.svelte';

  interface Props {
    open: boolean;
    defaultValue: string;
    onConfirm: (name: string) => void;
  }

  let { open = $bindable(false), defaultValue, onConfirm }: Props = $props();
</script>

<DialogName
  title="Edit Scene"
  nameText="Scene name"
  nameValue={defaultValue}
  bind:open
  {onConfirm}
/>
