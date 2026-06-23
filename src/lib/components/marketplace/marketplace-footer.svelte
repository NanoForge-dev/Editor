<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';

  interface Props {
    activeTab: string;
    input: string[];
    isLoading: boolean;
    onDequeue: (name: string) => void;
    onInstall: () => void;
    onClose: () => void;
  }

  const { activeTab, input, isLoading, onDequeue, onInstall, onClose }: Props = $props();
</script>

{#if activeTab === 'marketplace'}
  <div class="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2.5">
    <div class="flex min-w-0 flex-1 flex-wrap gap-1.5">
      {#each input as name (name)}
        <span
          class="bg-muted inline-flex items-center gap-1 rounded-full pl-6 pr-2 py-0.5 text-xs font-medium"
        >
          {name}
          <Button
            type="button"
            variant="ghost"
            class="hover:text-destructive ml-0.5 opacity-60 transition-opacity hover:opacity-100"
            size="icon"
            onclick={() => onDequeue(name)}
          >
            <span class="i-ic-round-close size-4"></span>
          </Button>
        </span>
      {/each}
      {#if input.length === 0}
        <span class="text-muted-foreground text-xs">Select packages to install</span>
      {/if}
    </div>
    <div class="flex shrink-0 gap-2">
      <Button
        variant="ghost"
        class="px-4 py-2 text-sm rounded-lg transition-all duration-150"
        onclick={onClose}
      >
        Cancel
      </Button>
      <Button
        class="px-4 py-2 text-sm rounded-lg transition-all duration-150"
        disabled={input.length === 0 || isLoading}
        onclick={onInstall}
      >
        {#if isLoading}
          <Spinner class="size-4" />
        {:else}
          <span class="i-ic-baseline-file-download size-4"></span>
        {/if}
        Apply{input.length > 0 ? ` (${input.length})` : ''}
      </Button>
    </div>
  </div>
{:else}
  <div class="flex shrink-0 items-center justify-end border-t border-border px-4 py-2.5">
    <Button
      variant="ghost"
      class="px-4 py-2 text-sm rounded-lg transition-all duration-150"
      onclick={onClose}
    >
      Close
    </Button>
  </div>
{/if}
