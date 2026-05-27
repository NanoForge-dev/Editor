<script lang="ts">
  import * as Tooltip from '$lib/components/ui/tooltip';
  import type { Snippet } from 'svelte';

  interface Props {
    text: string;
    children: Snippet;
    delayDuration?: number;
  }

  let { text, children, delayDuration = 100 }: Props = $props();
</script>

<Tooltip.Provider {delayDuration}>
  <Tooltip.Root>
    <Tooltip.Trigger>
      {@render children()}
    </Tooltip.Trigger>
    <Tooltip.Content>
      <p>{text}</p>
    </Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
