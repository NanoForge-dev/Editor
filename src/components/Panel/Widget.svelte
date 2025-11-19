<script lang="ts">
  import { widgetsTypes } from '../Widget/widgets';

  interface Props {
    size?: number;
    id?: string;
  }

  let { size, id }: Props = $props();

  const widgetsMap = Object.fromEntries(widgetsTypes.map((w) => [w.id, w.component]));

  let WidgetComponent = $derived(id ? widgetsMap[id] : null);
</script>

<div
  class="bg-neutral-800 w-full h-full rounded-md flex items-center justify-center text-white border border-neutral-600 overflow-hidden"
  style:flex-basis={size ? `${size}%` : '100%'}
  data-widget-id={id}
>
  {#if WidgetComponent}
    <WidgetComponent />
  {:else}
    <span class="text-sm">{id || 'Widget'}</span>
  {/if}
</div>
