<script lang="ts">
  import type { ComponentParamHandle } from '$lib/client/ecs';
  import { Input } from '$lib/components/ui/input';
  import { TristateSwitch } from '$lib/components/ui/tristate-switch';
  import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';

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
    {#if $param.enum}
      <Select type="single" bind:value onValueChange={handleChange}>
        <SelectTrigger class="w-full">{value}</SelectTrigger>
        <SelectContent>
          {#if Array.isArray($param.enum)}
            {#if !!$param.enum.length}
              {#each $param.enum as opt (opt)}
                <SelectItem value={opt}>{opt}</SelectItem>
              {/each}
            {:else}
              <div class="px-4 py-2 text-muted-foreground italic">No options</div>
            {/if}
          {:else}
            {#if Object.keys($param.enum).length === 0}
              {#each Object.entries($param.enum) as [displayOpt, realOpt] (displayOpt)}
                <SelectItem value={realOpt}>{displayOpt}</SelectItem>
              {/each}
            {:else}
              <div class="px-4 py-2 text-muted-foreground italic">No options</div>
            {/if}
          {/if}
        </SelectContent>
      </Select>
    {:else}
      <Input type="text" bind:value onchange={handleChange} />
    {/if}
  {:else if $param.type === 'number'}
    <Input type="number" bind:value onchange={handleChange} />
  {:else if $param.type === 'boolean'}
    <TristateSwitch bind:value onChange={handleChange} />
  {/if}
</div>
