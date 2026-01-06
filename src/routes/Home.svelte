<script lang="ts">
  import MenuBar from '../components/Menu/MenuBar.svelte';
  import Logo from '../assets/logo.png';
  import TabBar from '../components/Tabs/TabBar.svelte';
  import { type Tab, tabTypes } from '../components/Tabs/types';

  let tabs: Tab[] = $state([
    { type: tabTypes[0], title: 'Game' },
    { type: tabTypes[1], title: 'main.ts' },
  ]);
  let selected = $state(0);

  const Component = $derived(tabs[selected].type.component);
</script>

<div class="flex flex-col gap-1 h-screen">
  <header class="flex bg-neutral-900 h-16">
    <div class="flex w-full h-full">
      <a href="/" class="px-3 pb-1 pt-2 h-full"
        ><img src={Logo} alt="Logo" class="h-full rounded-full" /></a
      >
      <div class="flex flex-col justify-between h-full w-full">
        <MenuBar />
        <TabBar bind:tabs bind:selected />
      </div>
    </div>
    <div class="flex items-center h-full py-2">
      <button
        class="flex justify-between gap-2 items-center px-4 py-2 w-42 outline-solid outline-2 hover:outline-3 outline-neutral-700 rounded-md text-sm font-medium hover:font-semibold cursor-pointer"
      >
        <img
          class="w-7 h-7 rounded-sm"
          src="https://i1.sndcdn.com/artworks-mwgT5qK6AvkAzuNM-DcYxOA-t500x500.jpg"
          alt="game cover"
        />
        <span class="w-full font-semibold">Jump Out</span>
      </button>
      <button aria-label="profile" class="i-solar-user-circle-bold mx-4 w-12 h-12 cursor-pointer"
      ></button>
    </div>
  </header>
  <main class="flex-1 bg-neutral-900 w-full h-full min-h-0 p-2">
    <Component />
  </main>
</div>
