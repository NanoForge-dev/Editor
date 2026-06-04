<script lang="ts">
  import DialogName from '../../dialogs/dialog-name.svelte';

  interface Props {
    kind: 'entity' | 'folder';
    open: boolean;
    defaultValue: string;
    onConfirm: (name: string) => void;
  }

  let { kind, open = $bindable(false), defaultValue, onConfirm }: Props = $props();

  const name = $derived(kind === 'entity' ? 'Entity' : 'Folder');
</script>

<DialogName
  title={`Edit ${name}`}
  nameText={`${name} name`}
  nameValue={defaultValue}
  bind:open
  {onConfirm}
/>
