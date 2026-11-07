<script lang="ts">
  import { GROUPS, type GroupId } from '../../store/log-sources';
  import type { GroupStats } from './console-filters';

  interface Props {
    /** Whether each group's output is shown. */
    groups: Record<GroupId, boolean>;
    stats: Record<GroupId, GroupStats>;
  }

  let { groups = $bindable(), stats }: Props = $props();
</script>

<div class="chips" role="group" aria-label="Source groups">
  {#each GROUPS as group (group.id)}
    {@const stat = stats[group.id]}
    <button
      type="button"
      class="chip"
      aria-pressed={groups[group.id]}
      title={`${groups[group.id] ? 'Hide' : 'Show'} ${group.label.toLowerCase()} output`}
      onclick={() => (groups[group.id] = !groups[group.id])}
    >
      {group.label}
      <span class="lines">{stat.lines}</span>
      {#if !groups[group.id] && stat.alerts}
        <span class="alerts" title={`${stat.alerts} hidden warnings or errors`}>
          <span class="sr">, {stat.alerts} hidden warnings or errors</span>
        </span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .chips {
    display: flex;
    gap: var(--nf-space-1);
    align-items: center;
  }
  .chip {
    display: inline-flex;
    gap: var(--nf-space-1);
    align-items: center;
    height: 22px;
    padding: 0 var(--nf-space-2);
    border: 1px solid var(--nf-color-border);
    border-radius: 11px;
    background: none;
    color: var(--nf-color-text-faint);
    font: inherit;
    font-size: var(--nf-font-size-sm);
    cursor: pointer;
  }
  .chip:hover {
    background: var(--nf-color-hover);
  }
  .chip:focus-visible {
    outline: 1px solid var(--nf-color-focus);
    outline-offset: 1px;
  }
  .chip[aria-pressed='true'] {
    border-color: var(--nf-color-border-strong);
    background: var(--nf-color-pressed);
    color: var(--nf-color-text);
  }
  .chip .lines {
    color: var(--nf-color-text-faint);
    font-variant-numeric: tabular-nums;
  }
  .alerts {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--nf-color-warning);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
