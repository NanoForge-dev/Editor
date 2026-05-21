<script lang="ts">
  import CreateProject from '$lib/components/ProjectLoader/CreateProject.svelte';
  import * as Dialog from '$lib/components/ui/dialog';

  interface Props {
    open: boolean;
  }

  let { open = $bindable() }: Props = $props();

  const onClose = () => {
    open = false;
  };
</script>

<Dialog.Root bind:open>
  <Dialog.Content showCloseButton={false} class="p-0 gap-0 max-w-md overflow-hidden">
    <CreateProject {onClose} />
  </Dialog.Content>
</Dialog.Root>
