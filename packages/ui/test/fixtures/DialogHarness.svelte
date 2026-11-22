<script lang="ts">
  import Button from '../../src/components/button.svelte';
  import Dialog from '../../src/components/dialog.svelte';
  import Input from '../../src/components/input.svelte';

  const { focusInput = false }: { focusInput?: boolean } = $props();
  let input = $state<HTMLInputElement>();
</script>

<Dialog open title="New file" initialFocus={focusInput ? () => input : undefined}>
  <Input bind:ref={input} aria-label="Name" />
  {#snippet footer()}
    <Button>Create</Button>
  {/snippet}
</Dialog>
