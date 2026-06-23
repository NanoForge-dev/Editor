<script lang="ts">
  import type { ApiPackage } from '$lib/client/action';
  import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';

  import MarketplacePackageList from './marketplace-package-list.svelte';
  import MarketplaceSearch from './marketplace-search.svelte';

  interface Props {
    activeTab: string;
    search: string;
    selectedPackage: ApiPackage | null;
    packages: ApiPackage[];
    installedPackages: ApiPackage[];
    isFetching: boolean;
    isLoading: boolean;
    refetch: () => void;
    isInstalled: (pkg: ApiPackage) => boolean;
    isQueued?: (pkg: ApiPackage) => boolean;
    typeLabel: (type: 'component' | 'system') => string;
    onSelect: (pkg: ApiPackage | null) => void;
    onQueue?: (pkg: ApiPackage) => void;
    onDequeue?: (name: string) => void;
  }

  let {
    activeTab = $bindable(),
    search = $bindable(),
    isFetching,
    isLoading,
    selectedPackage,
    installedPackages,
    packages,
    refetch,
    isInstalled,
    isQueued,
    typeLabel,
    onSelect,
    onQueue,
    onDequeue,
  }: Props = $props();
</script>

<div class="flex w-72 shrink-0 flex-col border-r border-border">
  <Tabs bind:value={activeTab} class="flex min-h-0 flex-1 flex-col gap-0">
    <div class="shrink-0 border-b border-border px-2 pt-2">
      <TabsList variant="line" class="w-full justify-start gap-0">
        <TabsTrigger value="marketplace" class="px-3 text-xs">Marketplace</TabsTrigger>
        <TabsTrigger value="installed" class="px-3 text-xs">Installed</TabsTrigger>
      </TabsList>
    </div>

    <div class="shrink-0 px-2 py-2">
      <MarketplaceSearch
        bind:search
        {isFetching}
        onChange={() => {
          refetch();
          onSelect(null);
        }}
        onClear={() => {
          search = '';
          refetch();
        }}
      />
    </div>

    <TabsContent value="marketplace" class="m-0 min-h-0 flex-1 p-0">
      <MarketplacePackageList
        {packages}
        {isLoading}
        emptyMessage="No packages found"
        {selectedPackage}
        {isInstalled}
        {isQueued}
        {typeLabel}
        {onSelect}
        {onQueue}
        {onDequeue}
      />
    </TabsContent>

    <TabsContent value="installed" class="m-0 min-h-0 flex-1 p-0">
      <MarketplacePackageList
        packages={installedPackages}
        {isLoading}
        emptyMessage="No packages installed"
        {selectedPackage}
        {isInstalled}
        {typeLabel}
        {onSelect}
      />
    </TabsContent>
  </Tabs>
</div>
