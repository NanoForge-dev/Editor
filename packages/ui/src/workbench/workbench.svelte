<script lang="ts">
  import { type Layout, type SlotId, isSlotVisible } from '@nanoforge-dev/editor-layout';
  import type { Snippet } from 'svelte';

  import Button from '../components/button.svelte';
  import EmptyState from '../components/empty-state.svelte';
  import Splitter from '../components/splitter.svelte';
  import Toasts from '../components/toasts.svelte';
  import { type WorkbenchContext, setWorkbenchContext } from './workbench-context';
  import DockStack from './parts/DockStack.svelte';
  import DragOverlay from './parts/DragOverlay.svelte';
  import FloatWindow from './parts/FloatWindow.svelte';
  import PromptHost from './parts/PromptHost.svelte';
  import StatusBar from './parts/StatusBar.svelte';
  import ToolStripe from './parts/ToolStripe.svelte';
  import TopBar from './parts/TopBar.svelte';
  import WidgetHost from './parts/WidgetHost.svelte';

  const { context, brand }: { context: WorkbenchContext; brand?: Snippet } = $props();
  // svelte-ignore state_referenced_locally
  setWorkbenchContext(context);
  // svelte-ignore state_referenced_locally
  const { layout: controller, workbench, commands, logger } = context;
  const layoutState = controller.layout;
  const layout = $derived($layoutState);
  const docksHidden = controller.docksHidden;

  let root = $state<HTMLElement>();
  let leftHeight = $state(0);
  let rightHeight = $state(0);
  let bottomWidth = $state(0);
  /** Sizes previewed while dragging a splitter (committed on release). */
  let preview = $state<
    Partial<
      Record<'left' | 'right' | 'bottom' | 'splitLeft' | 'splitRight' | 'splitBottom', number>
    >
  >({});

  const shown = (current: Layout, slot: SlotId) =>
    !$docksHidden && isSlotVisible(current, slot) && current.slots[slot].stack.tabs.length > 0;

  const leftTop = $derived(shown(layout, 'leftTop'));
  const leftBottom = $derived(shown(layout, 'leftBottom'));
  const rightTop = $derived(shown(layout, 'rightTop'));
  const rightBottom = $derived(shown(layout, 'rightBottom'));
  const bottom = $derived(shown(layout, 'bottom'));
  const bottomRight = $derived(shown(layout, 'bottomRight'));

  const leftWidth = $derived(preview.left ?? layout.slots.leftTop.size);
  const rightWidth = $derived(preview.right ?? layout.slots.rightTop.size);
  const bottomHeight = $derived(preview.bottom ?? layout.slots.bottom.size);
  const splitLeft = $derived(preview.splitLeft ?? layout.split.left);
  const splitRight = $derived(preview.splitRight ?? layout.split.right);
  const splitBottom = $derived(preview.splitBottom ?? layout.split.bottom);

  let visitedScreens = $state<string[]>([]);
  $effect(() => {
    const active = layout.activeScreen;
    if (active && !visitedScreens.includes(active)) visitedScreens = [...visitedScreens, active];
  });

  const commit = (label: string, run: () => Promise<void>) =>
    run().catch((error: unknown) => logger.error(`${label} failed`, error));

  const resizeColumn = (side: 'left' | 'right', delta: number, final: boolean) => {
    const base = layout.slots[side === 'left' ? 'leftTop' : 'rightTop'].size;
    const size = Math.max(120, base + (side === 'left' ? delta : -delta));
    if (!final) {
      preview = { ...preview, [side]: size };
      return;
    }
    preview = { ...preview, [side]: undefined };
    const [top, low]: [SlotId, SlotId] =
      side === 'left' ? ['leftTop', 'leftBottom'] : ['rightTop', 'rightBottom'];
    void commit('Resize', () =>
      controller.apply(
        {
          type: 'batch',
          ops: [
            { type: 'resizeSlot', slot: top, size },
            { type: 'resizeSlot', slot: low, size },
          ],
        },
        'Resize panel',
      ),
    );
  };

  const resizeBottom = (delta: number, final: boolean) => {
    const size = Math.max(120, layout.slots.bottom.size - delta);
    if (!final) {
      preview = { ...preview, bottom: size };
      return;
    }
    preview = { ...preview, bottom: undefined };
    void commit('Resize', () =>
      controller.apply(
        {
          type: 'batch',
          ops: [
            { type: 'resizeSlot', slot: 'bottom', size },
            { type: 'resizeSlot', slot: 'bottomRight', size },
          ],
        },
        'Resize panel',
      ),
    );
  };

  const resizeSplit = (side: 'left' | 'right' | 'bottom', delta: number, final: boolean) => {
    const length = { left: leftHeight, right: rightHeight, bottom: bottomWidth }[side];
    if (!length) return;
    const ratio = Math.min(0.85, Math.max(0.15, layout.split[side] + delta / length));
    const key = ({ left: 'splitLeft', right: 'splitRight', bottom: 'splitBottom' } as const)[side];
    if (!final) {
      preview = { ...preview, [key]: ratio };
      return;
    }
    preview = { ...preview, [key]: undefined };
    void commit('Resize', () =>
      controller.apply({ type: 'setSplit', side, ratio }, 'Resize panels'),
    );
  };

  /** F6 / Shift+F6: moves focus between the parts of the workbench. */
  const focusPart = (direction: 1 | -1) => {
    if (!root) return;
    const parts = [...root.querySelectorAll<HTMLElement>('[data-nf-part]')];
    if (!parts.length) return;
    const current = parts.findIndex((part) => part.contains(document.activeElement));
    const next = parts[(current + direction + parts.length) % parts.length]!;
    const focusable = next.querySelector<HTMLElement>(
      '[tabindex="0"], button:not([tabindex="-1"]), input, textarea, select, [href]',
    );
    (focusable ?? next).focus();
  };

  $effect(() => {
    if (!root) return;
    const focus = workbench.trackFocus(root);
    const next = commands.register({
      id: 'workbench.focusNextPart',
      title: 'Focus next part',
      category: 'View',
      handler: () => focusPart(1),
    });
    const previous = commands.register({
      id: 'workbench.focusPreviousPart',
      title: 'Focus previous part',
      category: 'View',
      handler: () => focusPart(-1),
    });
    return () => {
      focus.dispose();
      next.dispose();
      previous.dispose();
    };
  });

  const maximized = $derived(
    layout.maximized
      ? [
          ...Object.values(layout.slots).flatMap((slot) => slot.stack.tabs),
          ...layout.floats.flatMap((float) => float.stack.tabs),
        ].find((ref) => ref.instanceId === layout.maximized)
      : undefined,
  );
</script>

<div class="workbench" bind:this={root}>
  <TopBar {layout} {brand} />

  <div class="body">
    {#if !$docksHidden}
      <ToolStripe {layout} side="left" />
    {/if}
    {#if leftTop || leftBottom}
      <div
        class="column"
        style:width="{leftWidth}px"
        bind:clientHeight={leftHeight}
        data-nf-part="left"
      >
        {#if leftTop}
          <div class="cell" style:flex={leftBottom ? `${splitLeft} 1 0` : '1 1 0'}>
            <DockStack stack={layout.slots.leftTop.stack} slot="leftTop" />
          </div>
        {/if}
        {#if leftTop && leftBottom}
          <Splitter
            orientation="horizontal"
            label="Resize left panels"
            onresize={(delta, final) => resizeSplit('left', delta, final)}
          />
        {/if}
        {#if leftBottom}
          <div class="cell" style:flex={leftTop ? `${1 - splitLeft} 1 0` : '1 1 0'}>
            <DockStack stack={layout.slots.leftBottom.stack} slot="leftBottom" />
          </div>
        {/if}
      </div>
      <Splitter
        orientation="vertical"
        label="Resize left column"
        value={leftWidth}
        onresize={(delta, final) => resizeColumn('left', delta, final)}
      />
    {/if}

    <div class="center">
      <main class="screen" data-nf-drop="center" data-nf-part="screen">
        {#if layout.screens.length === 0}
          <EmptyState
            icon="app-window"
            title="No main screen"
            description="Main screens come from plugins (code editor, viewport…)."
          />
        {/if}
        {#each visitedScreens.filter( (screen) => layout.screens.includes(screen) ) as screen (screen)}
          <WidgetHost
            ref={{ instanceId: screen, widgetId: screen }}
            active={layout.activeScreen === screen}
          />
        {/each}
      </main>
      {#if bottom || bottomRight}
        <Splitter
          orientation="horizontal"
          label="Resize bottom panel"
          value={bottomHeight}
          onresize={resizeBottom}
        />
        <div
          class="bottom"
          style:height="{bottomHeight}px"
          bind:clientWidth={bottomWidth}
          data-nf-part="bottom"
        >
          {#if bottom}
            <div class="cell" style:flex={bottomRight ? `${splitBottom} 1 0` : '1 1 0'}>
              <DockStack stack={layout.slots.bottom.stack} slot="bottom" />
            </div>
          {/if}
          {#if bottom && bottomRight}
            <Splitter
              orientation="vertical"
              label="Resize bottom panels"
              onresize={(delta, final) => resizeSplit('bottom', delta, final)}
            />
          {/if}
          {#if bottomRight}
            <div class="cell" style:flex={bottom ? `${1 - splitBottom} 1 0` : '1 1 0'}>
              <DockStack stack={layout.slots.bottomRight.stack} slot="bottomRight" />
            </div>
          {/if}
        </div>
      {/if}
    </div>

    {#if rightTop || rightBottom}
      <Splitter
        orientation="vertical"
        label="Resize right column"
        value={rightWidth}
        onresize={(delta, final) => resizeColumn('right', delta, final)}
      />
      <div
        class="column"
        style:width="{rightWidth}px"
        bind:clientHeight={rightHeight}
        data-nf-part="right"
      >
        {#if rightTop}
          <div class="cell" style:flex={rightBottom ? `${splitRight} 1 0` : '1 1 0'}>
            <DockStack stack={layout.slots.rightTop.stack} slot="rightTop" />
          </div>
        {/if}
        {#if rightTop && rightBottom}
          <Splitter
            orientation="horizontal"
            label="Resize right panels"
            onresize={(delta, final) => resizeSplit('right', delta, final)}
          />
        {/if}
        {#if rightBottom}
          <div class="cell" style:flex={rightTop ? `${1 - splitRight} 1 0` : '1 1 0'}>
            <DockStack stack={layout.slots.rightBottom.stack} slot="rightBottom" />
          </div>
        {/if}
      </div>
    {/if}
    {#if !$docksHidden}
      <ToolStripe {layout} side="right" />
    {/if}

    {#each layout.floats as float (float.id)}
      <div data-nf-part="float"><FloatWindow {float} /></div>
    {/each}

    {#if maximized}
      <div class="maximized" data-nf-part="maximized">
        <div class="maximized-bar">
          <span>{workbench.descriptor(maximized.widgetId)?.title ?? maximized.widgetId}</span>
          <Button
            size="sm"
            icon="minimize-2"
            onclick={() =>
              commit('Restore', () => controller.apply({ type: 'maximize', instanceId: null }))}
            >Restore</Button
          >
        </div>
        <div class="maximized-body"><WidgetHost ref={maximized} active /></div>
      </div>
    {/if}
  </div>

  <StatusBar />
  <DragOverlay />
  <PromptHost />
  <Toasts notifications={context.notifications} />
</div>

<style>
  .workbench {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100vh;
    background: var(--nf-color-bg);
  }
  .body {
    position: relative;
    display: flex;
    min-height: 0;
    overflow: hidden;
  }
  .column {
    display: flex;
    flex-direction: column;
    flex: none;
    min-width: 120px;
    max-width: 60vw;
  }
  .cell {
    min-width: 0;
    min-height: 0;
  }
  .center {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }
  .screen {
    position: relative;
    flex: 1;
    min-height: 0;
    background: var(--nf-color-surface);
  }
  .bottom {
    display: flex;
    flex: none;
    min-height: 120px;
    max-height: 70vh;
  }
  .maximized {
    position: absolute;
    inset: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    background: var(--nf-color-surface);
  }
  .maximized-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 30px;
    padding: 0 var(--nf-space-2) 0 var(--nf-space-3);
    border-bottom: 1px solid var(--nf-color-border);
  }
  .maximized-body {
    position: relative;
    flex: 1;
  }
</style>
