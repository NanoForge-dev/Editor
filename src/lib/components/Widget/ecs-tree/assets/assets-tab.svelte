<script lang="ts">
  import PackageTab from '../packages/package-tab.svelte';
  import type { AssetManager } from '$lib/client/ecs';

  interface Props {
    manager: AssetManager;
  }

  const { manager }: Props = $props();
</script>

<PackageTab type="asset" {manager} />
