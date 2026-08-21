<script lang="ts">
  import MenuBar from '$lib/components/Menu/MenuBar.svelte';
  import Logo from '$lib/assets/logo.png';
  import TabBar from '$lib/components/Tabs/TabBar.svelte';

  import DefaultProjectCover from '$lib/assets/defaultProjectCover.png';

  import { tabsStore } from '$lib/components/Tabs/store';
  import { tabRegistry } from '$lib/components/Tabs/registry';

  import { ProjectLoader, getProject } from '$lib/client/project';
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { runSafe } from '@utils-client/error';
  import { FullPageProjectSpinner } from '$lib/components/project-loader';
  import { MarketplaceDialog, setMarketplaceContext } from '$lib/components/marketplace';
  import { getProjectStore } from '$lib/client/project/project-loader/project-loader';

  const projectStore = getProjectStore();

  let marketplaceOpen = $state(false);
  setMarketplaceContext({ open: () => (marketplaceOpen = true) });

  let tab = $derived($tabsStore.tabs.find((t) => t.id === $tabsStore.selectedTabId));
  let Component = $derived(tab ? tabRegistry[tab.type]?.component : null);
  let loaded: boolean = $state(false);

  let projectName = $state('untitled');

  onMount(async (): Promise<void> => {
    let project = getProject();

    if (!project) {
      const id = page.url.searchParams.get('id');
      if (!id) {
        await goto(resolve('/'));
        return;
      }

      project = await runSafe(
        'load project',
        async () => {
          const project = await ProjectLoader.loadFromIdWithCacheFetching(id);
          if (project.id !== id) {
            await goto(resolve(`/dashboard?id=${project.id}`), {
              replaceState: true,
              keepFocus: true,
            });
          }
          return project;
        },
        async () => {
          await goto(resolve('/'));
        },
      );

      if (!project) return;
    }

    projectName = (await project.info.get()).name;

    if (!project.isReady()) {
      await runSafe(
        'init project',
        async () => {
          await project.init();
        },
        async () => {
          await goto(resolve('/'));
        },
      );
    }

    loaded = true;
  });
</script>

{#if loaded && $projectStore}
  <MarketplaceDialog bind:open={marketplaceOpen} />
  <div class="h-screen flex flex-col gap-1 bg-neutral-900">
    <header class="h-16 flex">
      <div class="h-full w-full flex">
        <img src={Logo} alt="Logo" class="h-full rounded-full px-3 pb-1 pt-2" />
        <div class="h-full w-full flex flex-col justify-between">
          <MenuBar />
          <TabBar />
        </div>
      </div>
      <div class="h-full flex items-center py-2 px-6 gap-2">
        <button
          class="w-42 flex cursor-pointer items-center justify-between gap-2 rounded-md px-4 py-2 font-medium text-sm outline-2 outline-neutral-700 outline-solid hover:outline-3 hover:font-semibold"
        >
          <img class="h-7 w-7 rounded-sm" src={DefaultProjectCover} alt="game cover" />
          <span class="w-full font-semibold">{projectName}</span>
        </button>
      </div>
    </header>
    <main class="h-full min-h-0 w-full flex-1 p-2">
      {#key $tabsStore.selectedTabId}
        {#if Component && tab}
          <Component bind:tab />
        {/if}
      {/key}
    </main>
  </div>
{:else}
  <FullPageProjectSpinner />
{/if}
