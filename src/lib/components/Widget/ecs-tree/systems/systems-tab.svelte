<script lang="ts">
  import PackageTab from '../packages/package-tab.svelte';
  import type { SystemManager } from '$lib/client/ecs';

  interface Props {
    manager: SystemManager;
  }

  const { manager }: Props = $props();
</script>

<PackageTab type="system" {manager} />
