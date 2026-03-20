<script lang="ts">
  import { widgetsTypes } from '../Widget/widgets';
  import type { Tab } from '$lib/components/Tabs/types';

  interface Props {
    size?: number;
    id?: string;
    tab: Tab;
  }

  let { size, id, tab = $bindable() }: Props = $props();

  const widgetsMap = Object.fromEntries(widgetsTypes.map((w) => [w.id, w.component]));

  let WidgetComponent = $derived(id ? widgetsMap[id] : null);
</script>

<div
  class="h-full w-full flex items-center justify-center overflow-hidden border border-neutral-600 rounded-md bg-neutral-800 text-white"
  style:flex-basis={size ? `${size}%` : '100%'}
  data-widget-id={id}
>
  {#if WidgetComponent}
    <WidgetComponent {tab} />
  {:else}
    <span class="text-sm">{id || 'Widget'}</span>
  {/if}
</div>
