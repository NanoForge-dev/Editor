<script lang="ts">
  import type { System } from '$lib/client/ecs';

  import DialogSelect from '../../dialogs/dialog-select.svelte';

  interface Props {
    open: boolean;
    systems: System[];
    onConfirm: (systemId: string) => void;
  }

  let { open = $bindable(), systems, onConfirm }: Props = $props();
</script>

<DialogSelect
  title="Add System to Scene"
  options={systems.map((sys) => ({ label: sys.name, value: sys.id }))}
  bind:open
  {onConfirm}
/>
