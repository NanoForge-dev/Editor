<script lang="ts">
  import type { SlotId, TabStack } from '@nanoforge-dev/editor-layout';
  import type { Snippet } from 'svelte';

  import ContextMenu from '../../components/context-menu.svelte';
  import Icon from '../../components/icon.svelte';
  import IconButton from '../../components/icon-button.svelte';
  import Menu from '../../components/menu.svelte';
  import { getWorkbenchContext } from '../workbench-context';
  import type { DropTarget } from '../layout/drag-controller';
  import WidgetHost from './WidgetHost.svelte';
  import { tabMenu } from './tab-menu';

  interface Props {
    stack: TabStack;
    /** A dock slot: its tabs are icons in a stripe, the stack shows the active one's header. */
    slot?: SlotId;
    floatId?: string;
    /** Extra controls at the start of the tab strip (float grip). */
    leading?: Snippet;
  }

  const { stack, slot, floatId, leading }: Props = $props();
  const { workbench, layout, drag, logger } = getWorkbenchContext();

  let strip = $state<HTMLElement>();
  let overflowing = $state(false);
  $effect(() => {
    const element = strip;
    if (!element) return;
    const measure = () => (overflowing = element.scrollWidth > element.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    void contains;
    measure();
    return () => observer.disconnect();
  });
  $effect(() => {
    const active = stack.active;
    if (!strip || !active) return;
    strip
      .querySelector(`[data-instance="${CSS.escape(active)}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });

  let visited = $state(new Set<string>());
  $effect(() => {
    if (stack.active && !visited.has(stack.active)) visited = new Set([...visited, stack.active]);
  });
  const contains = $derived(stack.tabs.map((tab) => tab.instanceId).join(' '));

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

  const menu = (instanceId: string) =>
    tabMenu(
      layout,
      instanceId,
      title(stack.tabs.find((t) => t.instanceId === instanceId)?.widgetId ?? instanceId),
      run,
    );
  const active = $derived(stack.tabs.find((tab) => tab.instanceId === stack.active));
</script>

<section class="stack" aria-label={active ? title(active.widgetId) : 'Empty panel'}>
  {#if slot}
    <div
      class="head tool"
      data-nf-drop="stack"
      data-slot={slot}
      data-count={stack.tabs.length}
      data-contains={contains}
    >
      {#if active}
        {@const activeTab = active}
        <ContextMenu items={() => menu(activeTab.instanceId)}>
          <div
            class="tool-title"
            role="presentation"
            onpointerdown={(event) =>
              drag.begin(
                event,
                activeTab.instanceId,
                title(activeTab.widgetId),
                onDrop(activeTab.instanceId),
              )}
          >
            <h2>{title(activeTab.widgetId)}</h2>
          </div>
        </ContextMenu>
        <Menu align="end" items={menu(activeTab.instanceId)}>
          {#snippet trigger({ props })}
            <IconButton
              {...props}
              icon="ellipsis-vertical"
              label="{title(activeTab.widgetId)} options"
              size={14}
            />
          {/snippet}
        </Menu>
        <IconButton
          icon="minus"
          label="Hide {title(activeTab.widgetId)}"
          size={14}
          onclick={() => layout.showSlot(slot, false)}
        />
      {/if}
    </div>
  {:else}
    <div class="head">
      <div
        class="strip"
        role="tablist"
        bind:this={strip}
        onwheel={(event) => {
          if (!overflowing || event.deltaX || !strip) return;
          strip.scrollLeft += event.deltaY;
        }}
        data-nf-drop="stack"
        data-slot={slot}
        data-float={floatId}
        data-count={stack.tabs.length}
        data-contains={contains}
      >
        {@render leading?.()}
        {#each stack.tabs as tab, index (tab.instanceId)}
          <ContextMenu items={() => menu(tab.instanceId)}>
            <div
              class="tab"
              class:active={tab.instanceId === stack.active}
              role="tab"
              tabindex={tab.instanceId === stack.active ? 0 : -1}
              aria-selected={tab.instanceId === stack.active}
              data-nf-drop="tab"
              data-slot={slot}
              data-float={floatId}
              data-index={index}
              data-contains={contains}
              data-instance={tab.instanceId}
              onpointerdown={(event) => {
                if ((event.target as HTMLElement).closest('.close')) return;
                drag.begin(event, tab.instanceId, title(tab.widgetId), onDrop(tab.instanceId));
              }}
              onclick={() => layout.focusTab(tab.instanceId)}
              onauxclick={(event) => event.button === 1 && run(layout.close(tab.instanceId))}
              onkeydown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') layout.focusTab(tab.instanceId);
                else if (event.key === 'Delete') run(layout.close(tab.instanceId));
              }}
            >
              {#if icon(tab.widgetId)}<Icon name={icon(tab.widgetId)} size={14} />{/if}
              <span class="title">{title(tab.widgetId)}</span>
              <button
                type="button"
                class="close"
                tabindex="-1"
                aria-label="Close {title(tab.widgetId)}"
                onclick={(event) => {
                  event.stopPropagation();
                  run(layout.close(tab.instanceId));
                }}
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          </ContextMenu>
        {/each}
      </div>
      {#if overflowing}
        <Menu
          align="end"
          items={stack.tabs.map((tab) => ({
            kind: 'item' as const,
            id: tab.instanceId,
            label: title(tab.widgetId),
            ...(icon(tab.widgetId) && { icon: icon(tab.widgetId) }),
            onSelect: () => layout.focusTab(tab.instanceId),
          }))}
        >
          {#snippet trigger({ props })}
            <button {...props} type="button" class="more" aria-label="Show all tabs">
              <Icon name="chevron-down" size={14} />
            </button>
          {/snippet}
        </Menu>
      {/if}
    </div>
  {/if}
  <div
    class="body"
    data-nf-drop="stack"
    data-slot={slot}
    data-float={floatId}
    data-count={stack.tabs.length}
    data-contains={contains}
  >
    {#each stack.tabs as tab (tab.instanceId)}
      {#if visited.has(tab.instanceId)}
        <WidgetHost
          ref={tab}
          active={tab.instanceId === stack.active}
          onclose={() => run(layout.close(tab.instanceId))}
        />
      {/if}
    {/each}
  </div>
</section>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--nf-color-surface);
  }
  .head {
    display: flex;
    flex: none;
    height: 28px;
    border-bottom: 1px solid var(--nf-color-border);
  }
  .tool {
    align-items: center;
    gap: 2px;
    height: 32px;
    padding-right: 4px;
  }
  .tool :global(.icon-button) {
    width: 24px;
    height: 24px;
  }
  .tool :global(.nf-context-area) {
    display: flex;
    flex: 1;
    align-self: stretch;
    min-width: 0;
  }
  .tool-title {
    display: flex;
    flex: 1;
    align-items: center;
    min-width: 0;
    padding: 0 10px;
    user-select: none;
    touch-action: none;
  }
  h2 {
    margin: 0;
    overflow: hidden;
    font-size: inherit;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .strip {
    display: flex;
    align-items: stretch;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }
  .more {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    padding: 0;
    border: 0;
    border-left: 1px solid var(--nf-color-border);
    background: transparent;
    color: var(--nf-color-text-muted);
    cursor: pointer;
  }
  .more:hover {
    background: var(--nf-color-hover);
    color: var(--nf-color-text);
  }
  .tab {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 200px;
    padding: 0 4px 0 10px;
    color: var(--nf-color-text-muted);
    border-right: 1px solid var(--nf-color-border);
    cursor: default;
    user-select: none;
    touch-action: none;
  }
  .tab:hover {
    color: var(--nf-color-text);
  }
  .active {
    background: var(--nf-color-raised);
    color: var(--nf-color-text);
    box-shadow: inset 0 2px 0 var(--nf-color-accent);
  }
  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .close {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: 0;
    border-radius: 2px;
    background: transparent;
    color: inherit;
    opacity: 0;
    cursor: pointer;
  }
  .tab:hover .close,
  .active .close,
  .close:focus-visible {
    opacity: 1;
  }
  .close:hover {
    background: var(--nf-color-hover);
  }
  .body {
    position: relative;
    flex: 1;
    min-height: 0;
  }
</style>
