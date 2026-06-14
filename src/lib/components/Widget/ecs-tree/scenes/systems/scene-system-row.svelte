<script lang="ts">
  import type { SceneSystemHandle } from '$lib/client/ecs';

  interface Props {
    handle: SceneSystemHandle;
  }

  const { handle }: Props = $props();

  const system = $derived(handle.store);
</script>

<span class="i-icomoon-free-steam w-3.5 h-3.5 shrink-0 text-amber-400"></span>
<span class="flex-1 truncate text-md text-foreground">{$system.name}</span>
