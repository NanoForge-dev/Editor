<script lang="ts">
  import type { MergeConflict } from '@nanoforge-dev/editor-sdk';
  import { Button } from '@nanoforge-dev/editor-sdk/ui';

  interface Props {
    conflicts: readonly MergeConflict[];
    onresolve: (key: string, value: unknown) => void;
  }

  const { conflicts, onresolve }: Props = $props();
  const format = (value: unknown) => (value === undefined ? '(unset)' : JSON.stringify(value));
</script>

<section class="page" aria-label="Sync conflicts">
  <h2>Sync conflicts</h2>
  <p class="hint">
    These settings changed on this device while offline and in your account meanwhile. Pick the
    value to keep.
  </p>
  {#each conflicts as conflict (conflict.key)}
    <div class="conflict">
      <code class="key">{conflict.key}</code>
      <div class="choices">
        <Button onclick={() => onresolve(conflict.key, conflict.local)}>
          This device: <code>{format(conflict.local)}</code>
        </Button>
        <Button onclick={() => onresolve(conflict.key, conflict.remote)}>
          Account: <code>{format(conflict.remote)}</code>
        </Button>
      </div>
    </div>
  {:else}
    <p>No conflicts.</p>
  {/each}
</section>

<style>
  .page {
    padding: var(--nf-space-3) var(--nf-space-4);
  }
  h2 {
    margin: 0 0 var(--nf-space-1);
    font-size: var(--nf-font-size-lg);
  }
  .hint {
    margin: 0 0 var(--nf-space-3);
    color: var(--nf-color-text-muted);
  }
  .conflict {
    padding: var(--nf-space-2) 0;
    border-bottom: 1px solid var(--nf-color-border);
  }
  .choices {
    display: flex;
    gap: var(--nf-space-2);
    margin-top: var(--nf-space-1);
  }
</style>
