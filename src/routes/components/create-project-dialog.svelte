<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import CreateProjectForm from './create-project-form.svelte';

  interface Props {
    open: boolean;
  }

  let { open = $bindable() }: Props = $props();

  const onClose = () => {
    open = false;
  };
</script>

<Dialog.Root bind:open>
  <Dialog.Content showCloseButton={false} class="p-0 gap-0 sm:max-w-xl w-[90vw] overflow-hidden">
    <CreateProjectForm {onClose} />
  </Dialog.Content>
</Dialog.Root>
