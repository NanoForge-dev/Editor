<script lang="ts">
  import Toolbar from '../Toolbar/Toolbar.svelte';
  import type { LayoutItem } from '../Panel/types';
  import Layout from '../Panel/Layout.svelte';
  import { cloneLayout } from '../Panel/utils';

  let layout: LayoutItem = $state({
    type: 'panel',
    direction: 'row',
    children: [
      {
        type: 'panel',
        direction: 'col',
        size: 60,
        children: [
          {
            type: 'panel',
            direction: 'row',
            size: 70,
            children: [
              { type: 'widget', size: 40, id: 'Widget A' },
              { type: 'widget', size: 60, id: 'Widget B' },
            ],
          },
          { type: 'widget', size: 30, id: 'content-browser' },
        ],
      },
      { type: 'widget', size: 40, id: 'Widget D' },
    ],
  });

  function handleLayoutChange(newLayout: LayoutItem) {
    layout = cloneLayout(newLayout);
  }
</script>

<Toolbar></Toolbar>
<div class="h-full w-full" data-layout-container>
  <Layout {layout} onLayoutChange={handleLayoutChange} />
</div>
