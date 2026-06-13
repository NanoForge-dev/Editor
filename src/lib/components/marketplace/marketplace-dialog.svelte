<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';

  import type { ApiPackage } from '$lib/client/action';
  import { useProject } from '$lib/client/project';
  import { Button } from '$lib/components/ui/button';
  import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';

  import MarketplaceFooter from './marketplace-footer.svelte';
  import MarketplacePackageDetails from './marketplace-package-details.svelte';
  import MarketplacePackageTabs from './marketplace-package-tabs.svelte';

  interface Props {
    open?: boolean;
  }

  let { open = $bindable(false) }: Props = $props();

  const { actions, packages, ecs } = useProject();

  let isLoading = $state(false);
  let input = $state<string[]>([]);
  let search = $state('');
  let selectedPackage = $state<ApiPackage | null>(null);
  let activeTab = $state('marketplace');

  const query = createQuery(() => ({
    queryKey: [],
    queryFn: () =>
      actions.package.searchPackages({
        page: 1,
        limit: 50,
        search,
      }),
  }));

  const componentStore = $derived(ecs.components.store);
  const systemStore = $derived(ecs.systems.store);

  const currentFileNames = $derived(
    new Set([
      ...$componentStore.map(
        (c) => [c.path.split('/').pop(), 'component' as const] as [string, 'component'],
      ),
      ...$systemStore.map(
        (s) => [s.path.split('/').pop(), 'system' as const] as [string, 'system'],
      ),
    ]),
  );

  const installedPackages = $derived(
    (query.data?.data ?? []).filter((pkg) => {
      for (const [filename, type] of currentFileNames) {
        const [username, pkgName] = pkg.name.split('/');
        if (filename.match(new RegExp(`^${username}-${pkgName}\\.${type}\\.[a-z]{1,4}$`)))
          return true;
      }
      return false;
    }),
  );

  const isInstalled = (pkg: ApiPackage) => installedPackages.some((p) => pkg.name === p.name);
  const isQueued = (pkg: ApiPackage) => input.includes(pkg.name);

  const onQueue = (pkg: ApiPackage) => {
    if (isInstalled(pkg) || isQueued(pkg)) return;
    input = [...input, pkg.name];
    selectedPackage = pkg;
  };

  const onDequeue = (name: string) => {
    input = input.filter((n) => n !== name);
  };

  const handleInstall = async () => {
    if (input.length === 0) return;
    isLoading = true;
    await packages.installPackages(input as [string, ...string[]]);
    open = false;
    input = [];
    isLoading = false;
  };

  const handleClose = () => {
    open = false;
    input = [];
    selectedPackage = null;
    search = '';
  };

  const typeLabel = (type: 'component' | 'system') =>
    type === 'component' ? 'Component' : 'System';
</script>

<Dialog bind:open>
  <DialogContent
    class="flex h-[680px] sm:max-w-5xl flex-col gap-0 overflow-hidden p-0"
    showCloseButton={false}
  >
    <DialogHeader class="shrink-0 border-b border-border px-4 py-3">
      <div class="flex items-center justify-between">
        <DialogTitle class="text-base font-semibold">Marketplace</DialogTitle>
        <Button variant="ghost" size="icon-sm" onclick={handleClose}>
          <span class="i-ic-round-close"></span>
          <span class="sr-only">Close</span>
        </Button>
      </div>
    </DialogHeader>

    <div class="flex min-h-0 flex-1">
      <MarketplacePackageTabs
        bind:activeTab
        bind:search
        {selectedPackage}
        packages={query.data?.data ?? []}
        {installedPackages}
        isFetching={query.isFetching}
        isLoading={query.isLoading}
        refetch={query.refetch}
        {isInstalled}
        {isQueued}
        {typeLabel}
        onSelect={(pkg) => (selectedPackage = pkg)}
        {onQueue}
        {onDequeue}
      />
      <div class="flex min-h-0 flex-1 flex-col">
        <MarketplacePackageDetails
          pkg={selectedPackage}
          {activeTab}
          {isInstalled}
          {isQueued}
          {typeLabel}
          {onQueue}
          {onDequeue}
        />
      </div>
    </div>

    <MarketplaceFooter
      {activeTab}
      {input}
      {isLoading}
      {onDequeue}
      onInstall={handleInstall}
      onClose={handleClose}
    />
  </DialogContent>
</Dialog>
