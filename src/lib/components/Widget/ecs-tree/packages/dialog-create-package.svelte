<script lang="ts">
  import DialogName from '../dialogs/dialog-name.svelte';
  import type { MaybePromise } from '@utils/types';

  interface Props {
    name: string;
    open: boolean;
    onConfirm: (name: string) => MaybePromise<void>;
    validate?: (name: string) => string | null;
  }

  let { name, open = $bindable(false), onConfirm, validate }: Props = $props();
</script>

<DialogName title={`Create ${name}`} nameText={`${name} name`} bind:open {onConfirm} {validate} />
