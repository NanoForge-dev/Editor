<script lang="ts" generics="T extends string">
  import { Select as BitsSelect } from 'bits-ui';

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
  const id = $props.id();
</script>

<BitsSelect.Root
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
  <BitsSelect.Trigger class="nf-select-trigger" aria-label={label} aria-describedby="{id}-value">
    <span id="{id}-value">{selected?.label ?? ''}</span>
    <Icon name="chevron-down" size={14} />
  </BitsSelect.Trigger>
  <BitsSelect.Portal>
    <BitsSelect.Content class="nf-popover" sideOffset={4}>
      <BitsSelect.Viewport>
        {#each items as item (item.value)}
          <BitsSelect.Item
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
          </BitsSelect.Item>
        {/each}
      </BitsSelect.Viewport>
    </BitsSelect.Content>
  </BitsSelect.Portal>
</BitsSelect.Root>
