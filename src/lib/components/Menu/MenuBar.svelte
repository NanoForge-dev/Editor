<script lang="ts">
  import MenuButton from './MenuButton.svelte';
  import MenuItem from './MenuItem.svelte';
  import { exportToZip, importFromZip } from '$lib/components/Utils/zip';
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';

  let fileInput: HTMLInputElement;

  async function handleImportClick() {
    fileInput.click();
  }

  async function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.zip')) return;

    await importFromZip(file);
    input.value = '';
  }
</script>

<div class="w-full flex">
  <MenuButton title="File">
    <MenuItem icon="i-solar-cloud-download-bold-duotone">Save</MenuItem>
    <MenuItem onClick={handleImportClick}>
      Import
      <input
        type="file"
        accept=".zip"
        bind:this={fileInput}
        class="hidden"
        on:change={handleFileChange}
      />
    </MenuItem>
    <MenuItem icon="i-solar-file-send-bold-duotone" onClick={() => exportToZip()}>Export</MenuItem>
    <MenuItem icon="i-solar-exit-bold-duotone" onClick={() => goto(resolve('/load-project'))}
      >Exit</MenuItem
    >
  </MenuButton>
  <MenuButton title="Edit">
    <MenuItem icon="i-solar-arrow-left-bold-duotone">Undo</MenuItem>
    <MenuItem icon="i-solar-arrow-right-bold-duotone">Redo</MenuItem>
    <MenuItem icon="i-solar-settings-bold-duotone">Project settings</MenuItem>
  </MenuButton>
  <MenuButton title="Help">
    <MenuItem icon="i-solar-book-2-bold-duotone">Documentation</MenuItem>
    <MenuItem icon="i-solar-info-circle-bold-duotone">About Us</MenuItem>
  </MenuButton>
</div>
