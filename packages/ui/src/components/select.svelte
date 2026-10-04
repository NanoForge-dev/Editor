<script lang="ts" generics="T extends string">
  import { Select } from 'bits-ui';

  import Icon from './icon.svelte';

  interface Props {
    value: T;
    items: readonly { value: T; label: string; disabled?: boolean }[];
    onchange?: (value: T) => void;
    label: string;
    disabled?: boolean;
  }

  const { value, items, onchange, label, disabled = false }: Props = $props();
  const selected = $derived(items.find((item) => item.value === value));
</script>

<Select.Root
  type="single"
  {value}
  {disabled}
  items={items.map((item) => ({
    value: item.value,
    label: item.label,
    disabled: item.disabled ?? false,
  }))}
  onValueChange={(next) => onchange?.(next as T)}
>
  <Select.Trigger class="nf-select-trigger" aria-label={label}>
    <span>{selected?.label ?? ''}</span>
    <Icon name="chevron-down" size={14} />
  </Select.Trigger>
  <Select.Portal>
    <Select.Content class="nf-popover" sideOffset={4}>
      <Select.Viewport>
        {#each items as item (item.value)}
          <Select.Item
            class="nf-menu-item"
            value={item.value}
            label={item.label}
            disabled={item.disabled ?? false}
          >
            {#snippet children({ selected: isSelected })}
              <span class="nf-menu-check"
                >{#if isSelected}<Icon name="check" size={14} />{/if}</span
              >
              {item.label}
            {/snippet}
          </Select.Item>
        {/each}
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>
