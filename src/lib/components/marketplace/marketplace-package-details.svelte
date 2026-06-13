<script lang="ts">
  import PackageIcon from '@lucide/svelte/icons/package';
  import PackageCheckIcon from '@lucide/svelte/icons/package-check';

  import type { ApiPackage } from '$lib/client/action';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { ScrollArea } from '$lib/components/ui/scroll-area';

  interface Props {
    pkg: ApiPackage | null;
    activeTab: string;
    isInstalled: (pkg: ApiPackage) => boolean;
    isQueued: (pkg: ApiPackage) => boolean;
    typeLabel: (type: 'component' | 'system') => string;
    onQueue: (pkg: ApiPackage) => void;
    onDequeue: (name: string) => void;
  }

  const { pkg, activeTab, isInstalled, isQueued, typeLabel, onQueue, onDequeue }: Props = $props();
</script>

{#if pkg}
  <ScrollArea class="h-full">
    <div class="p-6">
      <div class="mb-4 flex items-start gap-3">
        <div
          class={[
            'flex size-10 shrink-0 items-center justify-center rounded-lg',
            isInstalled(pkg) ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          ]}
        >
          {#if isInstalled(pkg)}
            <PackageCheckIcon class="size-5" />
          {:else}
            <PackageIcon class="size-5" />
          {/if}
        </div>
        <div class="flex-1">
          <h2 class="text-sm font-semibold">{pkg.name}</h2>
          <p class="text-muted-foreground text-xs">{typeLabel(pkg.type)}</p>
        </div>
        {#if activeTab === 'marketplace' && !isInstalled(pkg)}
          {#if isQueued(pkg)}
            <Button type="button" variant="destructive" onclick={() => onDequeue(pkg!.name)}>
              <span class="i-ic-round-close size-4"></span>
              Remove
            </Button>
          {:else}
            <Button onclick={() => onQueue(pkg!)}>
              <span class="i-ic-baseline-file-download size-4"></span>
              Install
            </Button>
          {/if}
        {/if}
      </div>

      {#if pkg.description}
        <div class="mb-4">
          <h3 class="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground">
            Description
          </h3>
          <p class="text-sm leading-relaxed">{pkg.description}</p>
        </div>
      {/if}

      {#if pkg.tags.length > 0}
        <div class="mb-4">
          <h3 class="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground">Tags</h3>
          <div class="flex flex-wrap gap-1.5">
            {#each pkg.tags as tag (tag)}
              <Badge variant="secondary" class="text-xs">{tag}</Badge>
            {/each}
          </div>
        </div>
      {/if}

      <div>
        <h3 class="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground">Type</h3>
        <Badge variant="outline">{typeLabel(pkg.type)}</Badge>
      </div>
    </div>
  </ScrollArea>
{:else}
  <div class="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2">
    <PackageIcon class="size-10 opacity-20" />
    <p class="text-sm">Select a package to view details</p>
  </div>
{/if}
