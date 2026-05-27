<script lang="ts" module>
  export type TriState = boolean | undefined;
</script>

<script lang="ts">
  import { Switch as SwitchPrimitive } from 'bits-ui';
  import { cn } from '@utils/ui';

  let {
    ref = $bindable(null),
    class: className,
    value = $bindable<TriState>(undefined),
    onChange = () => {},
    size = 'default',
    ...restProps
  }: {
    ref?: HTMLElement | null;
    class?: string;
    value?: TriState;
    onChange?: (value: TriState) => void;
    size?: 'sm' | 'default';
  } = $props();

  function toggle() {
    if (value === false) {
      value = undefined;
    } else {
      value = value === undefined;
    }

    onChange(value);
  }

  const bgClass = $derived(
    value === true ? 'bg-success' : value === false ? 'bg-destructive' : 'bg-neutral-500',
  );

  const thumbClass = $derived(
    value === true ? 'translate-x-6' : value === false ? 'translate-x-0' : 'translate-x-3',
  );
</script>

<SwitchPrimitive.Root
  bind:ref
  checked={value === true}
  onclick={toggle}
  data-slot="switch"
  data-size={size}
  class={cn(
    'focus-visible:ring-ring/50 inline-flex h-5 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50',
    bgClass,
    className,
  )}
  {...restProps}
>
  <SwitchPrimitive.Thumb
    data-slot="switch-thumb"
    class={cn(
      'pointer-events-none block h-4 w-4 rounded-full bg-foreground shadow-sm ring-0 transition-transform',
      thumbClass,
    )}
  />
</SwitchPrimitive.Root>
