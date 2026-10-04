<script lang="ts">
  import { getWorkbenchContext } from '../workbench-context';

  const { drag } = getWorkbenchContext();
  const dragging = drag.state;
</script>

{#if $dragging}
  {#if $dragging.target}
    {@const rect = $dragging.target.rect}
    <div
      class="zone"
      class:float={$dragging.target.kind === 'float'}
      style:left="{rect.left}px"
      style:top="{rect.top}px"
      style:width="{rect.width}px"
      style:height="{rect.height}px"
    ></div>
  {/if}
  <div class="ghost" style:left="{$dragging.x + 12}px" style:top="{$dragging.y + 8}px">
    {$dragging.title}
  </div>
{/if}

<style>
  .zone {
    position: fixed;
    z-index: var(--nf-z-menu);
    border: 2px solid var(--nf-color-focus);
    border-radius: var(--nf-radius-control);
    background: color-mix(in srgb, var(--nf-color-focus) 14%, transparent);
    pointer-events: none;
  }
  .float {
    border-style: dashed;
  }
  .ghost {
    position: fixed;
    z-index: var(--nf-z-menu);
    padding: 3px 8px;
    border-radius: var(--nf-radius-control);
    background: var(--nf-color-raised);
    box-shadow: var(--nf-shadow-float);
    pointer-events: none;
  }
</style>
