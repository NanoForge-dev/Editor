<script lang="ts">
  import ProjectCache from '$lib/components/Utils/LocalStorage/ProjectCache';
  import { Button } from '$lib/components/ui/button';

  import * as Card from '$lib/components/ui/card';
  import { Separator } from '$lib/components/ui/separator';
  import Components from './components';
  import { createQuery } from '@tanstack/svelte-query';
  import { getConfig } from '$lib/client/config';

  let showCreateProject = $state(false);

  const isOnline = getConfig().mode === 'online';

  const { data: projectListCache, isLoading } = createQuery(() => ({
    queryKey: ['projects-cache'],
    queryFn: () => {
      return ProjectCache.getProjects();
    },
  }));

  const handleCreateProject = () => {
    if (isOnline) return;
    showCreateProject = true;
  };

  const handleOpenProject = () => {
    if (isOnline) return;
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
        </div>

        <Separator orientation="vertical" class="h-auto self-stretch" />

        <div class="p-5 flex flex-col gap-3 min-h-64 w-10/19">
          <p class="text-sm text-muted-foreground px-2 mb-1">Recent</p>

          {#if isLoading}
            <Components.CacheProjectListSkeleton />
          {:else if projectListCache && projectListCache.length > 0}
            <div class="flex flex-col gap-1">
              {#each projectListCache as project (project.name)}
                <Components.CacheProject {project} />
              {/each}
            </div>

            <Button
              type="button"
              variant="ghost"
              class="mt-auto text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer self-end"
              onclick={() => {
                ProjectCache.clearProjects();
              }}
            >
              Clear cache
            </Button>
          {:else}
            <div class="flex-1 flex items-center justify-center">
              <p class="text-sm text-muted-foreground/50">No recent projects</p>
            </div>
          {/if}
        </div>
      </Card.Content>
    </Card.Root>
  </main>
</div>
