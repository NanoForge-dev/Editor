<script lang="ts">
  import DefaultProjectCover from '$lib/assets/defaultProjectCover.png';
  import type { ProjectDataCache } from '$lib/client/project';
  import { Spinner } from '$lib/components/ui/spinner';

  interface Props {
    project: ProjectDataCache;
    disabled?: boolean;
    isLoading?: boolean;
    onClick?: () => void;
    onRemove?: () => void;
  }

  const { project, disabled, isLoading, onClick, onRemove }: Props = $props();
</script>

<div class="flex items-center">
  <button
    disabled={disabled || isLoading || project.invalid}
    class={[
      'flex items-center gap-3 p-2 rounded-lg transition-colors text-left w-[calc(100%-3.25rem)]',
      disabled || isLoading || project.invalid
        ? 'opacity-50 cursor-not-allowed'
        : 'cursor-pointer hover:bg-muted/50',
    ]}
    onclick={onClick}
  >
    <img
      alt="{project.name ?? 'Unknown'} cover"
      src={project.imageUrl || DefaultProjectCover}
      class="size-9 rounded-md object-cover shrink-0"
    />
    <span class="flex flex-col min-w-0">
      <span class="text-sm font-medium truncate">{project.name ?? 'Unknown'}</span>
      <span class="text-xs text-muted-foreground truncate">{project.resolvable}</span>
    </span>
  </button>
  <div class="h-full aspect-square">
    {#if isLoading}
      <div class="h-full w-full flex items-center justify-center">
        <Spinner class="text-xl" />
      </div>
    {:else}
      <button
        aria-label="Remove project"
        title="Remove project"
        {disabled}
        onclick={onRemove}
        class={[
          'h-full w-full p-2 flex items-center justify-center rounded-lg transition-colors',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50',
        ]}
      >
        <div class="i-ic-round-close text-destructive text-xl"></div>
      </button>
    {/if}
  </div>
</div>
