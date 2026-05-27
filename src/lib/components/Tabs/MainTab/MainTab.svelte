<script lang="ts">
  import type { LayoutItem } from '../../Panel/types';
  import Layout from '../../Panel/Layout.svelte';
  import { cloneLayout } from '../../Panel/utils';
  import type { Tab } from '$lib/components/Tabs/types';

  interface Props {
    tab: Tab;
  }
  let { tab = $bindable() }: Props = $props();

  let layout: LayoutItem = $state({
    type: 'panel',
    direction: 'row',
    children: [
      {
        type: 'panel',
        direction: 'col',
        size: 70,
        children: [
          {
            type: 'panel',
            direction: 'row',
            size: 70,
            children: [
              { type: 'widget', size: 30, id: 'ecs-tree' },
              { type: 'widget', size: 70, id: 'editor-game' },
            ],
          },
          { type: 'widget', size: 30, id: 'content-browser' },
        ],
      },
      { type: 'widget', size: 30, id: 'entity-inspector' },
    ],
  });

  function handleLayoutChange(newLayout: LayoutItem) {
    layout = cloneLayout(newLayout);
  }
</script>

<div class="h-full w-full" data-layout-container>
  <Layout {layout} onLayoutChange={handleLayoutChange} bind:tab />
</div>
