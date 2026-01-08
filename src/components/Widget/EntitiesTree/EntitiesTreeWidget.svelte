<script lang="ts">
  import type { Entity } from '../../Entity/types';
  import EntityItem from './EntityItem.svelte';

  let entities: Entity[] = [
    {
      id: 'map',
      name: 'Map',
      type: 'folder',
      children: [
        {
          id: 'floor',
          name: 'Floor',
          type: 'entity',
        },
        {
          id: 'building',
          name: 'Building',
          type: 'entity',
        },
      ],
    },
    {
      id: 'mobs',
      name: 'Mobs',
      type: 'folder',
      children: [
        {
          id: 'zombies',
          name: 'Zombies',
          type: 'folder',
          children: [
            {
              id: 'zombie1',
              name: 'Zombie 1',
              type: 'entity',
            },
            {
              id: 'zombie2',
              name: 'Zombie 2',
              type: 'entity',
            },
          ],
        },
      ],
    },
  ];

  let selected: string[] = $state([]);
</script>

<div class="flex flex-col h-full w-full bg-neutral-800">
  <div class="flex justify-between p-2">
    <input
      class="bg-black rounded-md text-xs p-2 h-7 outline outline-1 outline-neutral-700"
      placeholder="Search entity"
    />
    <button
      class="bg-neutral-700 hover:bg-neutral-600 w-fit px-2 py-1 rounded-md cursor-pointer text-sm flex items-center gap-1 text-xs text-neutral-200"
    >
      <span class="i-ic-baseline-add"></span>
      Add Entity
    </button>
  </div>
  <div class="flex flex-col bg-neutral-900 h-full p-1">
    {#each entities as entity (entity.id)}
      <EntityItem item={entity} select={(id) => (selected = [id])} bind:selected />
    {/each}
  </div>
</div>
