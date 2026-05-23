<script lang="ts">
  import type { WithElementRef } from '@utils/ui';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '@utils/ui';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<nav
  bind:this={ref}
  data-slot="breadcrumb"
  aria-label="breadcrumb"
  class={cn('cn-breadcrumb', className)}
  {...restProps}
>
  {@render children?.()}
</nav>
