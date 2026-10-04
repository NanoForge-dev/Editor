<script lang="ts">
  import { Tooltip } from 'bits-ui';
  import type { Snippet } from 'svelte';

  interface Props {
    text: string;
    children: Snippet<[{ props: Record<string, unknown> }]>;
    side?: 'top' | 'bottom' | 'left' | 'right';
  }

  const { text, children, side = 'bottom' }: Props = $props();
</script>

<Tooltip.Provider>
  <Tooltip.Root delayDuration={500}>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        {@render children({ props })}
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content class="nf-tooltip" {side} sideOffset={6}>{text}</Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
</Tooltip.Provider>
