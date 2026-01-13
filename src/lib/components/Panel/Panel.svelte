<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    direction: 'row' | 'col';
    children: Snippet;
    size?: number;
  }

  let { direction, children, size }: Props = $props();
</script>

<div class="flex flex-{direction} w-full h-full" style:flex-basis={size ? `${size}%` : undefined}>
  {@render children()}
</div>
