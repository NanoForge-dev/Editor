<script lang="ts">
  import type { ComponentParamManager } from '$lib/client/ecs';

  import ComponentParamRow from './component-param-row.svelte';

  interface Props {
    manager: ComponentParamManager;
  }

  const { manager }: Props = $props();

  const params = $derived(manager.store);
</script>

{#each $params as param (param.name)}
  {@const handle = manager.get(param.name)}
  <ComponentParamRow {handle} />
{/each}
