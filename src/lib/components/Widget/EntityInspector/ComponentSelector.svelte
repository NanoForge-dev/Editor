<script lang="ts">
  import type { SaveComponent } from '@utils/types';

  interface Props {
    availableComponents: SaveComponent[];
    open: boolean;
    onClose: () => unknown;
    onSelect: (component: SaveComponent) => unknown;
  }

  let { availableComponents, open, onClose, onSelect }: Props = $props();
  let search = $state('');

  function close() {
    search = '';
    onClose();
  }

  function select(component: SaveComponent) {
    close();
    onSelect(component);
  }

  $effect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
</script>

{#if open}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    onclick={close}
    aria-hidden="true"
  >
    <div
      class="w-1/2 max-h-[70vh] rounded-lg bg-neutral-900 shadow-lg border border-neutral-700 p-4 flex flex-col"
      onclick={(e) => e.stopPropagation()}
      aria-hidden="true"
    >
      <input
        class="w-full mb-3 px-3 py-2 rounded bg-neutral-800 text-neutral-200 outline-none text-lg"
        placeholder="Search component..."
        bind:value={search}
      />

      <div class="flex-1 overflow-y-auto min-h-0">
        {#if availableComponents.length === 0}
          <div class="text-neutral-400 text-sm px-2 py-1">No component found</div>
        {:else}
          {#each availableComponents as component (component.name)}
            <button
              class="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-neutral-800 text-neutral-200 text-base"
              onclick={() => select(component)}
            >
              <span class="i-ic-baseline-token text-neutral-400 text-lg"></span>
              {component.name}
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}
