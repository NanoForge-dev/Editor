<script lang="ts">
  import type { ComponentParamHandle } from '$lib/client/ecs';
  import { Input } from '$lib/components/ui/input';
  import { TristateSwitch } from '$lib/components/ui/tristate-switch';

  interface Props {
    handle: ComponentParamHandle;
  }

  const { handle }: Props = $props();

  const param = $derived(handle.store);
  const defaultValue = $derived(handle.value);

  let value = $state<any>($defaultValue);

  const handleChange = () => {
    handle.value.set(value);
  };
</script>

<div class="grid grid-cols-[140px_1fr] m-2 mb-1 items-center gap-2">
  <div class="text-neutral-200 text-sm">{$param.name}</div>

  {#if $param.type === 'string'}
    <Input type="text" bind:value onchange={handleChange} />
  {:else if $param.type === 'number'}
    <Input type="number" bind:value onchange={handleChange} />
  {:else if $param.type === 'boolean'}
    <TristateSwitch bind:value onChange={handleChange} />
  {/if}
</div>
