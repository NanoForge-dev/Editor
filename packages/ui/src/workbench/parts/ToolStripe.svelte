<script lang="ts">
  import { type Layout, type SlotId, isSlotVisible } from '@nanoforge-dev/editor-layout';

  import ContextMenu from '../../components/context-menu.svelte';
  import Icon from '../../components/icon.svelte';
  import Tooltip from '../../components/tooltip.svelte';
  import { getWorkbenchContext } from '../workbench-context';
  import type { DropTarget } from '../layout/drag-controller';
  import { SLOT_LABELS, tabMenu } from './tab-menu';

  interface Props {
    layout: Layout;
    side: 'left' | 'right';
  }

  const { layout: current, side }: Props = $props();
  const { workbench, layout, drag, logger } = getWorkbenchContext();

  const groups = $derived<SlotId[]>(
    side === 'left'
      ? ['leftTop', 'leftBottom', 'bottom']
      : ['rightTop', 'rightBottom', 'bottomRight'],
  );

  const title = (widgetId: string) => workbench.descriptor(widgetId)?.title ?? widgetId;
  const icon = (widgetId: string) => workbench.descriptor(widgetId)?.icon;
  const run = (promise: Promise<unknown>) =>
    promise.catch((error: unknown) => logger.error('Layout change failed', error));

  const onDrop = (instanceId: string) => (target: DropTarget, x: number, y: number) => {
    if (target.kind === 'float') {
      run(layout.float(instanceId, { x: x - 40, y: y - 12, width: 360, height: 280 }));
    } else {
      run(
        layout
          .apply(
            { type: 'move', instanceId, location: target.location },
            `Move ${title(instanceId)}`,
          )
          .then(() => layout.focusTab(instanceId)),
      );
    }
  };

  type Handler = ((event: Event) => void) | undefined;
</script>

{#snippet group(slot: SlotId)}
  {@const stack = current.slots[slot].stack}
  {@const shown = isSlotVisible(current, slot)}
  {@const contains = stack.tabs.map((tab) => tab.instanceId).join(' ')}
  <div
    class="group"
    class:foot={slot === 'bottom' || slot === 'bottomRight'}
    role="tablist"
    aria-orientation="vertical"
    aria-label="{SLOT_LABELS[slot]} panels"
    data-nf-drop="stack"
    data-slot={slot}
    data-count={stack.tabs.length}
    data-contains={contains}
  >
    {#each stack.tabs as tab, index (tab.instanceId)}
      {@const selected = shown && tab.instanceId === stack.active}
      <ContextMenu items={() => tabMenu(layout, tab.instanceId, title(tab.widgetId), run)}>
        <Tooltip text={title(tab.widgetId)} side={side === 'left' ? 'right' : 'left'}>
          {#snippet children({ props })}
            <div
              {...props}
              class="tool"
              class:selected
              role="tab"
              tabindex={tab.instanceId === stack.active ? 0 : -1}
              aria-label={title(tab.widgetId)}
              aria-selected={selected}
              data-nf-drop="tab"
              data-axis="y"
              data-slot={slot}
              data-index={index}
              data-contains={contains}
              data-instance={tab.instanceId}
              onpointerdown={(event) => {
                (props.onpointerdown as Handler)?.(event);
                drag.begin(event, tab.instanceId, title(tab.widgetId), onDrop(tab.instanceId));
              }}
              onclick={(event) => {
                (props.onclick as Handler)?.(event);
                layout.toggleTool(tab.instanceId);
              }}
              onauxclick={(event) => event.button === 1 && run(layout.close(tab.instanceId))}
              onkeydown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  layout.toggleTool(tab.instanceId);
                } else if (event.key === 'Delete') run(layout.close(tab.instanceId));
              }}
            >
              <Icon name={icon(tab.widgetId)} size={18} />
            </div>
          {/snippet}
        </Tooltip>
      </ContextMenu>
    {/each}
  </div>
{/snippet}

<nav class="stripe {side}" aria-label="{side === 'left' ? 'Left' : 'Right'} tool windows">
  {@render group(groups[0]!)}
  {#if current.slots[groups[0]!].stack.tabs.length && current.slots[groups[1]!].stack.tabs.length}
    <hr />
  {/if}
  {@render group(groups[1]!)}
  <div class="spacer"></div>
  {@render group(groups[2]!)}
</nav>

<style>
  .stripe {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: center;
    width: 40px;
    padding: 6px 0;
    background: var(--nf-color-bg);
  }
  .left {
    border-right: 1px solid var(--nf-color-border);
  }
  .right {
    border-left: 1px solid var(--nf-color-border);
  }
  .group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-height: 12px;
  }
  .spacer {
    flex: 1;
  }
  hr {
    width: 20px;
    margin: 6px 0;
    border: 0;
    border-top: 1px solid var(--nf-color-border);
  }
  .tool {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: var(--nf-radius-control);
    color: var(--nf-color-text-muted);
    cursor: default;
    user-select: none;
    touch-action: none;
  }
  .tool:hover {
    background: var(--nf-color-hover);
    color: var(--nf-color-text);
  }
  .tool:focus-visible {
    outline: 2px solid var(--nf-color-focus);
    outline-offset: -2px;
  }
  .selected,
  .selected:hover {
    background: var(--nf-color-pressed);
    color: var(--nf-color-text);
  }
</style>
