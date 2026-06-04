<script lang="ts">
  import SceneList from './scene-list.svelte';
  import SceneDetail from './scene-detail.svelte';
  import type { SceneManager } from '$lib/client/ecs';

  interface Props {
    manager: SceneManager;
  }

  const { manager }: Props = $props();

  let selected = $state<string | null>(manager.defaultData);

  manager.store.subscribe((scenes) => {
    if (!scenes.find((scene) => scene.id === selected)) selected = null;
  });
</script>

<div class="flex flex-1 min-h-0">
  <SceneList {manager} bind:selected />

  {#if selected}
    <SceneDetail handle={manager.get(selected)} />
  {:else}
    <div class="flex flex-1 items-center justify-center text-xs text-muted-foreground">
      Select a scene
    </div>
  {/if}
</div>
