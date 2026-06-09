<script lang="ts">
  import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
  import ScenesTab from './scenes/scenes-tab.svelte';
  import ComponentsTab from './components/components-tab.svelte';
  import LibrariesTab from './libraries/libraries-tab.svelte';
  import SystemsTab from './systems/systems-tab.svelte';
  import { useProject } from '$lib/client/project';
  import { setContext } from 'svelte';

  const { ecs } = useProject();

  let selectedTab = $state('scenes');
  let query = $state({ entities: '', packages: '' });

  const selectTab = (tab: string) => {
    selectedTab = tab;
  };

  setContext('selectTab', selectTab);
  setContext('ecsQuery', query);
</script>

<Tabs
  bind:value={selectedTab}
  class="h-full w-full gap-0 bg-neutral-900 text-sm select-none overflow-hidden"
>
  <TabsList
    variant="line"
    class="w-full justify-start rounded-none border-b border-border bg-neutral-800 shrink-0 h-auto py-0 px-0 gap-0"
  >
    <TabsTrigger value="scenes" class="px-2 py-1 mx-2 my-1">Scenes</TabsTrigger>
    <TabsTrigger value="components" class="px-2 py-1 mx-2 my-1">Components</TabsTrigger>
    <TabsTrigger value="systems" class="px-2 py-1 mx-2 my-1">Systems</TabsTrigger>
    <TabsTrigger value="libraries" class="px-2 py-1 mx-2 my-1">Libraries</TabsTrigger>
  </TabsList>
  <TabsContent value="scenes" class="flex-1 min-h-0">
    <ScenesTab manager={ecs.scenes} />
  </TabsContent>
  <TabsContent value="components" class="flex-1 min-h-0">
    <ComponentsTab manager={ecs.components} />
  </TabsContent>
  <TabsContent value="systems" class="flex-1 min-h-0">
    <SystemsTab manager={ecs.systems} />
  </TabsContent>
  <TabsContent value="libraries" class="flex-1 min-h-0">
    <LibrariesTab manager={ecs.libraries} />
  </TabsContent>
</Tabs>
