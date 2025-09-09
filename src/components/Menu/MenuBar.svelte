<script>
  import MenuButton from './MenuButton.svelte';
  import MenuItem from './MenuItem.svelte';
</script>

<div class="flex w-full">
  <MenuButton title="File">
    <MenuItem icon="i-solar-cloud-download-bold-duotone">Save</MenuItem>
    <MenuItem icon="i-solar-file-send-bold-duotone">Export</MenuItem>
    <MenuItem icon="i-solar-exit-bold-duotone">Exit</MenuItem>
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
