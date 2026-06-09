<script lang="ts">
  import { Select as SelectPrimitive } from 'bits-ui';
  import SelectPortal from './select-portal.svelte';
  import SelectScrollUpButton from './select-scroll-up-button.svelte';
  import SelectScrollDownButton from './select-scroll-down-button.svelte';
  import { cn, type WithoutChild, type WithoutChildrenOrChild } from '@utils/ui';
  import type { ComponentProps } from 'svelte';

  let {
    ref = $bindable(null),
    class: className,
    sideOffset = 4,
    portalProps,
    children,
    preventScroll = true,
    ...restProps
  }: WithoutChild<SelectPrimitive.ContentProps> & {
    portalProps?: WithoutChildrenOrChild<ComponentProps<typeof SelectPortal>>;
  } = $props();
</script>

<SelectPortal {...portalProps}>
  <SelectPrimitive.Content
    bind:ref
    {sideOffset}
    {preventScroll}
    data-slot="select-content"
    class={cn(
      'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 min-w-36 rounded-lg shadow-md ring-1 ring-foreground/10 duration-100 relative isolate z-50 overflow-x-hidden overflow-y-auto',
      className,
    )}
    {...restProps}
  >
    <SelectScrollUpButton />
    <SelectPrimitive.Viewport
      class={cn('h-auto max-h-80 w-full min-w-(--bits-select-anchor-width)')}
    >
      {@render children?.()}
    </SelectPrimitive.Viewport>
    <SelectScrollDownButton />
  </SelectPrimitive.Content>
</SelectPortal>
