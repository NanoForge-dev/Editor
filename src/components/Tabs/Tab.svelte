<script lang="ts">
  import type { Tab } from './Tab';

  interface Props {
    tab: Tab;
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
  class="flex gap-2 items-center justify-between w-56 px-3 py-2 cursor-pointer {selected
    ? 'bg-neutral-700'
    : 'hover:bg-neutral-800'} rounded-lg"
>
  <span class="flex items-center gap-2 text-sm w-full {selected ? 'font-bold' : ''} truncate">
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
      class="text-xl hover:text-red-600 rounded-full cursor-pointer ml-2"
      aria-label="Fermer l’onglet"
    >
      ×
    </span>
  {/if}
</button>
