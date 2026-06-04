<script lang="ts">
  import PackageTab from '../packages/package-tab.svelte';
  import type { ComponentManager } from '$lib/client/ecs';

  interface Props {
    manager: ComponentManager;
  }

  const { manager }: Props = $props();
</script>

<PackageTab type="component" {manager} />
