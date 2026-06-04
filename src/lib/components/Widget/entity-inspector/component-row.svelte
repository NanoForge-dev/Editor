<script lang="ts">
  import type { EntityComponentHandle } from '$lib/client/ecs';
  import { DeleteConfirmDialog } from '$lib/components/dialogs';

  import ComponentParamList from './component-param-list.svelte';

  interface Props {
    handle: EntityComponentHandle;
  }

  const { handle }: Props = $props();

  const component = $derived(handle.store);

  let componentCollapsed = $state(false);
  let deleteOpen = $state(false);

  const onDelete = (e: MouseEvent) => {
    e.stopPropagation();
    deleteOpen = true;
  };

  const handleDelete = () => {
    handle.delete();
  };
</script>

<DeleteConfirmDialog
  type="Component"
  name={$component.name}
  bind:open={deleteOpen}
  onConfirm={handleDelete}
/>
<button
  class="text-neutral-200 text-md px-4 w-full flex cursor-pointer items-center gap-1 bg-neutral-800 px-2 py-1 font-semibold text-neutral-300 text-sm"
  onclick={() => (componentCollapsed = !componentCollapsed)}
>
  <span
    aria-hidden="true"
    class="{!componentCollapsed ? 'i-solar-alt-arrow-down-bold' : 'i-solar-alt-arrow-right-bold'}
            w-4 text-center select-none text-neutral-400 hover:text-neutral-200"
  ></span>
  <span class="i-ic-baseline-token text-neutral-400"></span>
  {$component.name}
  <span
    class="i-solar-trash-bin-minimalistic-linear text-red-500 text-align-end"
    aria-hidden="true"
    onclick={onDelete}
  ></span>
</button>
{#if !componentCollapsed}
  <ComponentParamList manager={handle.params} />
{/if}
