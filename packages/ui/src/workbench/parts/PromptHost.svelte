<script lang="ts">
  import Button from '../../components/button.svelte';
  import Dialog from '../../components/dialog.svelte';
  import Input from '../../components/input.svelte';
  import { getWorkbenchContext } from '../workbench-context';

  const { prompts } = getWorkbenchContext();
  const current = prompts.current;
  let value = $state('');
  let open = $state(false);

  $effect(() => {
    open = !!$current;
    value = $current?.value ?? '';
  });

  const error = $derived($current?.validate?.(value));
  const submit = () => {
    if (!error && (value.trim() || $current?.optional)) $current?.resolve(value.trim());
  };
</script>

{#if $current}
  <Dialog bind:open title={$current.title} onclose={() => $current?.resolve(undefined)}>
    <form
      class="prompt"
      onsubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label>
        <span>{$current.label}</span>
        <Input bind:value invalid={!!error} autofocus />
      </label>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <div class="actions">
        <Button onclick={() => $current?.resolve(undefined)}>Cancel</Button>
        <Button
          variant="primary"
          type="submit"
          disabled={!!error || (!value.trim() && !$current?.optional)}
          >{$current.confirm ?? 'OK'}</Button
        >
      </div>
    </form>
  </Dialog>
{/if}

<style>
  .prompt {
    display: grid;
    gap: var(--nf-space-3);
  }
  label {
    display: grid;
    gap: var(--nf-space-1);
    color: var(--nf-color-text-muted);
  }
  .error {
    margin: 0;
    color: var(--nf-color-danger);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--nf-space-2);
  }
</style>
