<script lang="ts">
  import DialogName from '../../dialogs/dialog-name.svelte';

  interface Props {
    kind: 'entity' | 'folder';
    open: boolean;
    onConfirm: (name: string) => void;
  }

  let { kind, open = $bindable(false), onConfirm }: Props = $props();

  const name = $derived(kind === 'entity' ? 'Entity' : 'Folder');
</script>

<DialogName title={`New ${name}`} nameText={`${name} name`} bind:open {onConfirm} />
