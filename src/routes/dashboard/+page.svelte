<script lang="ts">
  import MenuBar from '$lib/components/Menu/MenuBar.svelte';
  import Logo from '$lib/assets/logo.png';
  import TabBar from '$lib/components/Tabs/TabBar.svelte';

  import { tabsStore } from '$lib/components/Tabs/store';
  import { tabRegistry } from '$lib/components/Tabs/registry';
  import { Spinner } from '$lib/components/ui/spinner';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';

  import { ProjectLoader, useProject } from '$lib/client/project';
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { runSafe } from '@utils-client/error';

  let tab = $derived($tabsStore.tabs.find((t) => t.id === $tabsStore.selectedTabId));
  let Component = $derived(tab ? tabRegistry[tab.type]?.component : null);
  let loaded: boolean = $state(false);

  onMount(async (): Promise<void> => {
    let project = useProject();

    if (!project) {
      const id = page.url.searchParams.get('id');
      if (!id) {
        await goto(resolve('/'));
        return;
      }

      project = await runSafe(
        'load project',
        async () => {
          return await ProjectLoader.loadFromIdWithCacheFetching(id);
        },
        async () => {
          await goto(resolve('/'));
        },
      );

      if (!project) return;
    }

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

{#if loaded}
  <div class="h-screen flex flex-col gap-1">
    <header class="h-16 flex bg-neutral-900">
      <div class="h-full w-full flex">
        <img src={Logo} alt="Logo" class="h-full rounded-full px-3 pb-1 pt-2" />
        <div class="h-full w-full flex flex-col justify-between">
          <MenuBar />
          <TabBar />
        </div>
      </div>
      <div class="h-full flex items-center py-2 gap-2">
        <button
          aria-label="push"
          class="flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-1 font-medium text-sm bg-none outline-none hover:font-semibold"
        >
          <span class="i-ic-baseline-file-upload"></span>
        </button>
        <button
          class="w-42 flex cursor-pointer items-center justify-between gap-2 rounded-md px-4 py-2 font-medium text-sm outline-2 outline-neutral-700 outline-solid hover:outline-3 hover:font-semibold"
        >
          <img
            class="h-7 w-7 rounded-sm"
            src="https://i1.sndcdn.com/artworks-mwgT5qK6AvkAzuNM-DcYxOA-t500x500.jpg"
            alt="game cover"
          />
          <span class="w-full font-semibold">Jump Out</span>
        </button>
        <button aria-label="profile" class="i-solar-user-circle-bold mx-4 h-12 w-12 cursor-pointer"
        ></button>
      </div>
    </header>
    <main class="h-full min-h-0 w-full flex-1 bg-neutral-900 p-2">
      {#key $tabsStore.selectedTabId}
        {#if Component && tab}
          <Component bind:tab />
        {/if}
      {/key}
    </main>
  </div>
{:else}
  <div class="w-screen h-screen flex items-center justify-center">
    <Card.Root class="flex flex-col items-center p-6 animate-spin scale-150">
      <Card.Header class="flex flex-col items-center text-center">
        <Spinner />
        <Card.Title>Project loading...</Card.Title>
        <Card.Description>Retrieving save</Card.Description>
      </Card.Header>

      <Card.Content class="mt-4">
        <Button
          variant="outline"
          size="sm"
          onclick={() => {
            goto(resolve('/'));
          }}
        >
          Cancel
        </Button>
      </Card.Content>
    </Card.Root>
  </div>
{/if}
