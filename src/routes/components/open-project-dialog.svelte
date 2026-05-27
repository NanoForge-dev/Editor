<script lang="ts">
  import OpenProjectForm from './open-project-form.svelte';
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
  <Dialog.Content showCloseButton={false} class="p-0 gap-0 sm:max-w-xl w-[90vw] overflow-hidden">
    <OpenProjectForm {onClose} />
  </Dialog.Content>
</Dialog.Root>
