<script lang="ts">
  import type { Tab, TabInstance } from './types';

  interface Props {
    tab: TabInstance;
    meta?: Tab;
    selected?: boolean;
    closable?: boolean;
    onSelect?: () => void;
    onClose?: () => void;
  }
  let {
    tab,
    meta,
    selected = false,
    closable = true,
    onSelect = () => {},
    onClose = () => {},
  }: Props = $props();
</script>

<button
  onclick={onSelect}
  onauxclick={(e) => {
    if (e.button === 1) {
      e.preventDefault();
      onClose();
    }
  }}
  class="flex gap-2 items-center justify-center w-56 px-3 py-2 cursor-pointer {selected
    ? 'bg-neutral-800'
    : 'hover:bg-neutral-800'} rounded-lg"
>
  <span
    class="flex items-center justify-center gap-2 text-sm w-full {selected
      ? 'font-bold'
      : ''} truncate"
  >
    <span class="{meta?.icon || ''} flex-shrink-0"></span>
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
      onclick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onkeydown={(e) => e.key === 'Enter' && onClose()}
      class="i-solar:close-circle-line-duotone"
      aria-label="Close tab"
    >
    </span>
  {/if}
</button>
