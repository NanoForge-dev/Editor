<script lang="ts">
  import { Combobox } from 'bits-ui';

  import Icon from './icon.svelte';

  interface Props {
    value: string;
    items: readonly { value: string; label: string; detail?: string }[];
    onchange?: (value: string) => void;
    label: string;
    placeholder?: string;
  }

  const { value, items, onchange, label, placeholder }: Props = $props();
  let search = $state('');
  const filtered = $derived(
    search
      ? items.filter((item) => item.label.toLowerCase().includes(search.toLowerCase()))
      : items,
  );
</script>

<Combobox.Root
  type="single"
  {value}
  items={items.map((item) => ({ value: item.value, label: item.label }))}
  onValueChange={(next) => onchange?.(next)}
  onOpenChange={(open) => !open && (search = '')}
>
  <div class="nf-combobox">
    <Combobox.Input
      class="nf-combobox-input"
      aria-label={label}
      {placeholder}
      oninput={(event) => (search = event.currentTarget.value)}
    />
    <Combobox.Trigger class="nf-combobox-trigger" aria-label="Show options">
      <Icon name="chevron-down" size={14} />
    </Combobox.Trigger>
  </div>
  <Combobox.Portal>
    <Combobox.Content class="nf-popover" sideOffset={4}>
      {#each filtered as item (item.value)}
        <Combobox.Item class="nf-menu-item" value={item.value} label={item.label}>
          <span>{item.label}</span>
          {#if item.detail}<span class="nf-menu-detail">{item.detail}</span>{/if}
        </Combobox.Item>
      {:else}
        <p class="nf-menu-empty">No match</p>
      {/each}
    </Combobox.Content>
  </Combobox.Portal>
</Combobox.Root>
