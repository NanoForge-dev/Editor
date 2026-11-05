<script lang="ts">
  import { type IconComponent, resolveIconOf } from './icons';

  interface Props {
    /** Registered icon name (see `registerIcons`), or an icon theme's. */
    name?: string;
    /** Or an icon component directly. */
    icon?: IconComponent;
    size?: number;
    label?: string;
  }

  const { name, icon, size = 16, label }: Props = $props();
  const resolved = $derived(
    icon
      ? { kind: 'component' as const, component: icon }
      : (resolveIconOf(name) ?? resolveIconOf('box')),
  );
</script>

{#if resolved?.kind === 'url'}
  <span
    class="nf-icon-file"
    style:width="{size}px"
    style:height="{size}px"
    style:--nf-icon-url="url({JSON.stringify(resolved.url)})"
    aria-hidden={label ? undefined : 'true'}
    aria-label={label}
    role={label ? 'img' : undefined}
  ></span>
{:else if resolved}
  <resolved.component
    {size}
    strokeWidth={1.75}
    aria-hidden={label ? undefined : 'true'}
    aria-label={label}
    role={label ? 'img' : undefined}
  />
{/if}

<style>
  /** An SVG file drawn in the text's color: a mask, so it can't run scripts nor pick colors. */
  .nf-icon-file {
    display: inline-block;
    flex: none;
    background-color: currentColor;
    -webkit-mask: var(--nf-icon-url) center / contain no-repeat;
    mask: var(--nf-icon-url) center / contain no-repeat;
  }
</style>
