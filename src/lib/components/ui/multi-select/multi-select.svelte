<script lang="ts">
  import { Popover, Checkbox } from 'bits-ui';
  import { cn } from '@utils/ui';

  interface Option {
    value: string;
    label: string;
  }

  interface Props {
    value?: string[];
    onValueChange?: (value: string[]) => void;
    options: Option[];
    placeholder?: string;
    class?: string;
    disabled?: boolean;
    id?: string;
    name?: string;
  }

  let {
    value = $bindable([]),
    onValueChange,
    options,
    placeholder = 'Select...',
    class: className,
    disabled,
    id,
    name,
  }: Props = $props();

  let open = $state(false);

  const selectedLabels = $derived(
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? value[0])
        : `${value.length} selected`,
  );
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    {id}
    {disabled}
    data-slot="multi-select-trigger"
    class={cn(
      'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      value.length === 0 && 'text-muted-foreground',
      className,
    )}
  >
    <span class="truncate">{selectedLabels}</span>
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      class={cn('size-4 opacity-50 shrink-0 transition-transform', open && 'rotate-180')}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  </Popover.Trigger>

  <Popover.Portal>
    <Popover.Content
      sideOffset={4}
      data-slot="multi-select-content"
      class="bg-popover text-popover-foreground z-50 min-w-32 overflow-hidden rounded-md border shadow-md w-[var(--bits-floating-anchor-width)]"
    >
      <Checkbox.Group
        {name}
        bind:value
        onValueChange={(v) => onValueChange?.(v)}
        class="flex flex-col p-1"
      >
        {#each options as option (option.value)}
          <label
            class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground select-none"
          >
            <Checkbox.Root
              value={option.value}
              class="peer size-4 shrink-0 rounded-sm border border-primary shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            >
              {#snippet children({ checked: isChecked })}
                <span class={cn('flex items-center justify-center', !isChecked && 'invisible')}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    class="size-3"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              {/snippet}
            </Checkbox.Root>
            {option.label}
          </label>
        {/each}
      </Checkbox.Group>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
