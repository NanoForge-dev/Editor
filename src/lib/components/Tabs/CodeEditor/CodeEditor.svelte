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
    direction: 'col',
    size: 70,
    children: [
      { type: 'widget', size: 70, id: 'code-editor' },
      { type: 'widget', size: 30, id: 'output-log' },
    ],
  });

  function handleLayoutChange(newLayout: LayoutItem) {
    layout = cloneLayout(newLayout);
  }
</script>

<div class="h-full w-full" data-layout-container>
  <Layout {layout} onLayoutChange={handleLayoutChange} bind:tab />
</div>
