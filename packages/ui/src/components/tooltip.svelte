<script lang="ts">
  import { Tooltip as BitsTooltip } from 'bits-ui';
  import type { Snippet } from 'svelte';

  interface Props {
    text: string;
    children: Snippet<[{ props: Record<string, unknown> }]>;
    side?: 'top' | 'bottom' | 'left' | 'right';
  }

  const { text, children, side = 'bottom' }: Props = $props();
</script>

<BitsTooltip.Provider>
  <BitsTooltip.Root delayDuration={500}>
    <BitsTooltip.Trigger>
      {#snippet child({ props })}
        {@render children({ props })}
      {/snippet}
    </BitsTooltip.Trigger>
    <BitsTooltip.Portal>
      <BitsTooltip.Content class="nf-tooltip" {side} sideOffset={6}>{text}</BitsTooltip.Content>
    </BitsTooltip.Portal>
  </BitsTooltip.Root>
</BitsTooltip.Provider>
