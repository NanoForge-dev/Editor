<script lang="ts">
  import type { ApiPackage } from '$lib/client/action';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Spinner } from '$lib/components/ui/spinner';

  import MarketplacePackageItem from './marketplace-package-item.svelte';

  interface Props {
    packages: ApiPackage[];
    isLoading: boolean;
    emptyMessage: string;
    selectedPackage: ApiPackage | null;
    isInstalled: (pkg: ApiPackage) => boolean;
    isQueued?: (pkg: ApiPackage) => boolean;
    typeLabel: (type: 'component' | 'system') => string;
    onSelect: (pkg: ApiPackage) => void;
    onQueue?: (pkg: ApiPackage) => void;
    onDequeue?: (name: string) => void;
  }

  let {
    packages,
    isLoading,
    emptyMessage,
    selectedPackage,
    isInstalled,
    isQueued,
    typeLabel,
    onSelect,
    onQueue,
    onDequeue,
  }: Props = $props();
</script>

<ScrollArea class="h-full">
  {#if isLoading}
    <div class="flex items-center justify-center py-8">
      <Spinner class="size-5" />
    </div>
  {:else if packages.length === 0}
    <p class="text-muted-foreground px-3 py-6 text-center text-xs">{emptyMessage}</p>
  {:else}
    <div class="py-1">
      {#each packages as pkg (pkg.id)}
        <MarketplacePackageItem
          {pkg}
          active={selectedPackage?.id === pkg.id}
          installed={isInstalled(pkg)}
          queued={isQueued?.(pkg) ?? false}
          {typeLabel}
          onSelect={() => onSelect(pkg)}
          onQueue={onQueue ? () => onQueue(pkg) : undefined}
          onDequeue={onDequeue ? () => onDequeue(pkg.name) : undefined}
        />
      {/each}
    </div>
  {/if}
</ScrollArea>
