<script lang="ts">
  import MenuButton from './MenuButton.svelte';
  import MenuItem from './MenuItem.svelte';
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import type { Snippet } from 'svelte';
  import { ProjectLoader } from '$lib/client/project';
  import { PUBLIC_DOCS_URL, PUBLIC_LANDING_URL } from '$env/static/public';

  let fileInput: HTMLInputElement;

  type MenuItem = { icon: string } & (
    | {
        name: string;
      }
    | {
        snippet: Snippet;
      }
  ) &
    ({ onClick: () => void; link?: string } | { onClick?: () => void; link: string });

  interface Menu {
    name: string;
    items: MenuItem[];
  }

  async function handleImportClick() {
    fileInput.click();
  }

  async function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.zip')) return;

    //await importFromZip(file);
    input.value = '';
  }

  const nullFunction = () => {};

  const elements: Menu[] = [
    {
      name: 'File',
      items: [
        { name: 'Save', icon: 'i-solar-cloud-download-bold-duotone', onClick: nullFunction },
        {
          snippet: fileImportSnippet,
          icon: 'i-solar-download-bold-duotone',
          onClick: handleImportClick,
        },
        { name: 'Export', icon: 'i-solar-file-send-bold-duotone', onClick: nullFunction },
        {
          name: 'Exit',
          icon: 'i-solar-exit-bold-duotone',
          onClick: () => {
            ProjectLoader.unload();
            goto(resolve('/'));
          },
        },
      ],
    },
    {
      name: 'Edit',
      items: [
        { name: 'Undo', icon: 'i-solar-arrow-left-bold-duotone', onClick: nullFunction },
        { name: 'Redo', icon: 'i-solar-arrow-right-bold-duotone', onClick: nullFunction },
        { name: 'Project settings', icon: 'i-solar-settings-bold-duotone', onClick: nullFunction },
      ],
    },
    {
      name: 'Help',
      items: [
        { name: 'Documentation', icon: 'i-solar-book-2-bold-duotone', link: PUBLIC_DOCS_URL },
        {
          name: 'About Us',
          icon: 'i-solar-info-circle-bold-duotone',
          link: `${PUBLIC_LANDING_URL}/about`,
        },
      ],
    },
  ];
</script>

{#snippet fileImportSnippet()}
  Import
  <input
    type="file"
    accept=".zip"
    bind:this={fileInput}
    class="hidden"
    on:change={handleFileChange}
  />
{/snippet}

<div class="w-full flex">
  {#each elements as menu (menu.name)}
    <MenuButton title={menu.name}>
      {#each menu.items as item, i (i)}
        <MenuItem icon={item.icon} link={item.link} onClick={item.onClick}>
          {#if 'snippet' in item}
            {@render item.snippet()}
          {:else}
            {item.name}
          {/if}
        </MenuItem>
      {/each}
    </MenuButton>
  {/each}
</div>
