<script lang="ts">
  import type { EntityComponentManager } from '$lib/client/ecs';

  import ComponentRow from './component-row.svelte';

  interface Props {
    manager: EntityComponentManager;
  }

  const { manager }: Props = $props();

  const components = $derived(manager.store);
</script>

<div class="my-2">
  {#each Object.keys($components) as component (component)}
    {@const handle = manager.get(component)}
    <ComponentRow {handle} />
  {/each}
</div>
