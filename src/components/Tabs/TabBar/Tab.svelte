<script lang="ts">
  import type { Types } from '../types';

  interface Props {
    tab: Types;
    selected?: boolean;
    closable?: boolean;
    onSelect?: () => void;
    onClose?: () => void;
  }
  let {
    tab,
    selected = $bindable(false),
    closable = true,
    onSelect = () => {},
    onClose = () => {},
  }: Props = $props();
</script>

<button
  onclick={onSelect}
  class="flex gap-2 items-center justify-center w-56 px-3 py-2 cursor-pointer {selected
    ? 'bg-neutral-800'
    : 'hover:bg-neutral-800'} rounded-lg"
>
  <span
    class="flex items-center justify-center gap-2 text-sm w-full {selected
      ? 'font-bold'
      : ''} truncate"
  >
    <span class="{tab.type.icon} flex-shrink-0"></span>
    <span
      class="flex-1 text-start text-sm {selected ? 'font-bold' : ''} truncate relative"
      style="mask-image: linear-gradient(to left, transparent, black 10%); -webkit-mask-image: linear-gradient(to left, transparent, black 10%);"
    >
      {tab.title}
    </span>
  </span>

  {#if closable}
    <span
      role="button"
      tabindex="0"
      onclick={onClose}
      onkeydown={(e) => e.key === 'Enter' && onClose()}
      class="i-solar:close-circle-line-duotone"
      aria-label="Close tab"
    >
    </span>
  {/if}
</button>
