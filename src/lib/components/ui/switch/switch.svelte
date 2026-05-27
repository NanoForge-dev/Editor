<script lang="ts">
  import { Switch as SwitchPrimitive } from 'bits-ui';
  import { cn, type WithoutChildrenOrChild } from '@utils/ui';

  let {
    ref = $bindable(null),
    class: className,
    checked = $bindable(false),
    size = 'default',
    ...restProps
  }: WithoutChildrenOrChild<SwitchPrimitive.RootProps> & {
    size?: 'sm' | 'default';
  } = $props();
</script>

<SwitchPrimitive.Root
  bind:ref
  bind:checked
  data-slot="switch"
  data-size={size}
  class={cn(
    'focus-visible:ring-ring/50 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
    className,
  )}
  {...restProps}
>
  <SwitchPrimitive.Thumb
    data-slot="switch-thumb"
    class="pointer-events-none block h-4 w-4 rounded-full bg-foreground shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
  />
</SwitchPrimitive.Root>
