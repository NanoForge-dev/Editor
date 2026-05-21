<script lang="ts">
  import { resolve } from '$app/paths';
  import MenuBar from '$lib/components/Menu/MenuBar.svelte';
  import Logo from '$lib/assets/logo.png';
  import TabBar from '$lib/components/Tabs/TabBar.svelte';
  import { tabRegistry } from '$lib/components/Tabs/registry';
  import { tabsStore } from '$lib/components/Tabs/store';
  import { onMount } from 'svelte';
  import { localApi } from '$lib/components/Utils/api/api';

  let tab = $derived($tabsStore.tabs.find((t) => t.id === $tabsStore.selectedTabId));
  let Component = $derived(tab ? tabRegistry[tab.type]?.component : null);

  onMount(async () => {
    await localApi.fetchSave('client');
  });
</script>

<div class="h-screen flex flex-col gap-1">
  <header class="h-16 flex bg-neutral-900">
    <div class="h-full w-full flex">
      <a href={resolve('/')} class="h-full px-3 pb-1 pt-2">
        <img src={Logo} alt="Logo" class="h-full rounded-full" />
      </a>
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
