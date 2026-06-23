<script lang="ts">
  import PackageIcon from '@lucide/svelte/icons/package';
  import PackageCheckIcon from '@lucide/svelte/icons/package-check';

  import type { ApiPackage } from '$lib/client/action';
  import { Button } from '$lib/components/ui/button';

  interface Props {
    pkg: ApiPackage;
    active: boolean;
    installed: boolean;
    queued?: boolean;
    typeLabel: (type: 'component' | 'system') => string;
    onSelect: () => void;
    onQueue?: () => void;
    onDequeue?: () => void;
  }

  const {
    pkg,
    active,
    installed,
    queued = false,
    typeLabel,
    onSelect,
    onQueue,
    onDequeue,
  }: Props = $props();
</script>

<div
  role="button"
  tabindex="0"
  class="group relative flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors {active
    ? 'bg-muted/70'
    : 'hover:bg-muted/50'}"
  onclick={onSelect}
  onkeydown={(e) => e.key === 'Enter' && onSelect()}
>
  <div
    class={[
      'flex size-7 shrink-0 items-center justify-center rounded-md',
      installed ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
    ]}
  >
    {#if installed}
      <PackageCheckIcon class="size-3.5" />
    {:else}
      <PackageIcon class="size-3.5" />
    {/if}
  </div>
  <div class="min-w-0 flex-1">
    <p class="truncate text-xs font-medium leading-tight">{pkg.name}</p>
    <p class="text-muted-foreground text-[10px]">{typeLabel(pkg.type)}</p>
  </div>

  {#if installed}
    <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-primary">
      Installed
    </span>
  {:else if onQueue || onDequeue}
    {#if queued}
      <Button
        size="icon"
        variant="destructive"
        class="invisible shrink-0 p-0.5 transition-colors hover:bg-primary/10 group-hover:visible"
        onclick={(e) => {
          e.stopPropagation();
          onDequeue?.();
        }}
        title="Remove from queue"
      >
        <span class="i-ic-round-close size-4"></span>
      </Button>
    {:else}
      <Button
        size="icon"
        variant="ghost"
        class="invisible shrink-0 p-0.5 transition-colors hover:bg-primary/10 group-hover:visible"
        onclick={(e) => {
          e.stopPropagation();
          onQueue?.();
        }}
        title="Queue for install"
      >
        <span class="i-ic-baseline-file-download size-4"></span>
      </Button>
    {/if}
  {/if}
</div>
