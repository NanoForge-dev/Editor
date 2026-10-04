<script lang="ts">
  import { type IconComponent, resolveIcon } from './icons';

  interface Props {
    /** Registered icon name (see `registerIcons`). */
    name?: string;
    /** Or an icon component directly. */
    icon?: IconComponent;
    size?: number;
    label?: string;
  }

  const { name, icon, size = 16, label }: Props = $props();
  const Resolved = $derived(icon ?? resolveIcon(name) ?? resolveIcon('box'));
</script>

{#if Resolved}
  <Resolved
    {size}
    strokeWidth={1.75}
    aria-hidden={label ? undefined : 'true'}
    aria-label={label}
    role={label ? 'img' : undefined}
  />
{/if}
