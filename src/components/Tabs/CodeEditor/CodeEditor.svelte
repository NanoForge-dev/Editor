<script lang="ts">
  import type { LayoutItem } from '../../Panel/types';
  import Layout from '../../Panel/Layout.svelte';
  import { cloneLayout } from '../../Panel/utils';

  let layout: LayoutItem = $state({
    type: 'panel',
    direction: 'col',
    size: 70,
    children: [
      {
        type: 'panel',
        direction: 'row',
        size: 70,
        children: [
          { type: 'widget', size: 15, id: 'content-browser-lite' },
          { type: 'widget', size: 85, id: 'code-editor' },
        ],
      },
      { type: 'widget', size: 30, id: 'output-log' },
    ],
  });

  function handleLayoutChange(newLayout: LayoutItem) {
    layout = cloneLayout(newLayout);
  }
</script>

<div class="h-full w-full" data-layout-container>
  <Layout {layout} onLayoutChange={handleLayoutChange} />
</div>
