<script lang="ts">
  import { DeleteConfirmDialog } from '$lib/components/dialogs';
  import { capitalize } from '@utils/string';

  interface Props {
    kind: 'entity' | 'folder';
    open: boolean;
    name: string;
    onConfirm: () => void;
  }

  let { kind, open = $bindable(false), name, onConfirm }: Props = $props();
</script>

<DeleteConfirmDialog type={capitalize(kind)} {name} bind:open {onConfirm} />
