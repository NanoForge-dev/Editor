<script lang="ts">
  import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
  import EntityTree from './entities/entity-tree.svelte';
  import SceneSystemsList from './systems/scene-systems-list.svelte';
  import type { SceneHandle } from '$lib/client/ecs';
  import { useProject } from '$lib/client/project';

  interface Props {
    handle: SceneHandle;
  }

  const { handle }: Props = $props();

  const { ecs } = useProject();

  const scene = $derived(handle.store);
  const activeScene = $derived(ecs.scenes.activeStore);

  const isActive = $derived($activeScene.id === handle.id);
</script>

<div class="flex flex-1 flex-col min-w-0">
  <div class="shrink-0 flex items-center gap-2 border-b border-border px-3 py-2 bg-neutral-800/40">
    <span class="i-clarity-picture-solid text-indigo-400 w-4 h-4"></span>
    <span class="font-semibold text-foreground text-xs">{$scene.name}</span>
    {#if isActive}
      <div class="ml-auto flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-green-400"></span>
        <span class="text-xs text-muted-foreground">Active</span>
      </div>
    {/if}
  </div>

  <Tabs value="entities" class="flex-1 min-h-0 gap-0">
    <TabsList
      variant="line"
      class="w-full justify-start rounded-none border-b border-border bg-neutral-800/20 shrink-0 h-auto py-0 px-0 gap-0"
    >
      <TabsTrigger value="entities" class="px-3 py-1.5 text-xs">Entities</TabsTrigger>
      <TabsTrigger value="sceneSystems" class="px-3 py-1.5 text-xs">Systems</TabsTrigger>
    </TabsList>
    <TabsContent value="entities" class="flex-1 min-h-0 overflow-y-auto">
      <EntityTree manager={handle.entities} />
    </TabsContent>
    <TabsContent value="sceneSystems" class="flex-1 min-h-0 overflow-y-auto">
      <SceneSystemsList manager={handle.systems} />
    </TabsContent>
  </Tabs>
</div>
