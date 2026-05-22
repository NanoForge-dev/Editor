<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';

  import { getConfig } from '$lib/client/config';
  import { ProjectCache, type ProjectDataCache, ProjectLoader } from '$lib/client/project';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Separator } from '$lib/components/ui/separator';
  import Components from './components';
  import { goto } from '$app/navigation';

  let showCreateProject = $state(false);
  let showOpenProject = $state(false);
  let cacheProjectLoading = $state<string | true | null>(null);

  const isOnline = getConfig().mode === 'online';

  const cacheQuery = createQuery(() => ({
    queryKey: ['projects-cache'],
    queryFn: async () => {
      return ProjectCache.getProjects();
    },
  }));

  const handleCreateProject = () => {
    if (isOnline) return;
    showCreateProject = true;
  };

  const handleOpenProject = () => {
    if (isOnline) return;
    showOpenProject = true;
  };

  const handleCacheProject = async (cache: ProjectDataCache) => {
    try {
      cacheProjectLoading = cache.id;
      const project = await ProjectLoader.loadFromCacheWithTryId(cache);
      await goto(`/dashboard?id=${project.id}`);
      cacheProjectLoading = null;
    } catch (error) {
      console.error(`Error loading project ${cache.id} (${cache.resolvable}) from cache:`, error);
      await ProjectCache.invalidateProject(cache.id);
      await cacheQuery.refetch();
      cacheProjectLoading = null;
    }
  };

  const handleCacheRemoveProject = async (cache: ProjectDataCache) => {
    cacheProjectLoading = cache.id;
    await ProjectCache.removeProject(cache.id);
    await cacheQuery.refetch();
    cacheProjectLoading = null;
  };

  const handleClearCache = async () => {
    cacheProjectLoading = true;
    await ProjectCache.clearProjects();
    await cacheQuery.refetch();
    cacheProjectLoading = null;
  };
</script>

<div class="min-h-screen w-full flex flex-col bg-background text-foreground text-base">
  <Components.Header />

  <main class="flex-1 flex items-center justify-center p-6">
    <Card.Root class="w-full max-w-2xl">
      <Card.Content class="p-0 flex justify-between h-[30vh]">
        <div class="flex flex-col gap-2 p-5 w-8/19">
          <p class="text-sm text-muted-foreground px-2 mb-1">Projects</p>

          {#if isOnline}
            <Components.OnlineProjectButtons />
          {:else}
            <Components.OfflineProjectButtons {handleCreateProject} {handleOpenProject} />
          {/if}

          <Components.CreateProjectDialog bind:open={showCreateProject} />
          <Components.OpenProjectDialog bind:open={showOpenProject} />
        </div>

        <Separator orientation="vertical" class="h-auto self-stretch" />

        <div class="p-5 flex flex-col gap-3 w-10/19 h-full">
          <p class="text-sm text-muted-foreground px-2 mb-1">Recent</p>

          {#if cacheQuery.isLoading || !cacheQuery.isFetched}
            <Components.CacheProjectListSkeleton />
          {:else if cacheQuery.data && cacheQuery.data.length > 0}
            <div class="flex flex-col gap-1">
              {#each cacheQuery.data as project (project.id)}
                <Components.CacheProject
                  {project}
                  disabled={!!cacheProjectLoading}
                  isLoading={cacheProjectLoading === project.id}
                  onClick={() => handleCacheProject(project)}
                  onRemove={() => handleCacheRemoveProject(project)}
                />
              {/each}
            </div>

            <Button
              type="button"
              variant="ghost"
              class="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer self-end justify-self-end"
              onclick={handleClearCache}
            >
              Clear cache
            </Button>
          {:else}
            <div class="flex h-full items-center justify-center text-center">
              <p class="text-sm text-muted-foreground/50 mb-4 mr-4">No recent projects</p>
            </div>
          {/if}
        </div>
      </Card.Content>
    </Card.Root>
  </main>
</div>
