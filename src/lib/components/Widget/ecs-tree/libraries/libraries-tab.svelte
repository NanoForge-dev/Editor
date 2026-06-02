<script lang="ts">
  import PackageTab from '../packages/package-tab.svelte';
  import type { LibraryManager } from '$lib/client/ecs';

  interface Props {
    manager: LibraryManager;
  }

  const { manager }: Props = $props();
</script>

<PackageTab type="library" {manager} />
