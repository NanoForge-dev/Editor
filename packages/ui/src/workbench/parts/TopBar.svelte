<script lang="ts">
  import type { Layout } from '@nanoforge-dev/editor-layout';
  import type { Snippet } from 'svelte';

  import Icon from '../../components/icon.svelte';
  import IconButton from '../../components/icon-button.svelte';
  import { MENU_BAR } from '../extension-point/menu.extension-point';
  import { TOOLBAR_ITEMS } from '../extension-point/toolbar.extension-point';
  import { getWorkbenchContext } from '../workbench-context';
  import MenuBarMenu from './MenuBarMenu.svelte';

  const { layout: current, brand }: { layout: Layout; brand?: Snippet } = $props();
  const context = getWorkbenchContext();
  const menuBar = context.extensions.observe(MENU_BAR);
  const toolbar = context.extensions.observe(TOOLBAR_ITEMS);

  /** Bumped when context keys change, so `when` and `toggled` clauses are re-evaluated. */
  let keys = $state(0);
  $effect(() => {
    const subscription = context.contextKeys.onDidChange(() => keys++);
    return () => subscription.dispose();
  });
  const tools = $derived.by(() => {
    void keys;
    return $toolbar
      .map((contribution) => contribution.value)
      .filter((item) => context.contextKeys.evaluate(item.when))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((item) => ({
        item,
        pressed: item.toggled ? context.contextKeys.evaluate(item.toggled) : undefined,
      }));
  });

  const screenTitle = (id: string) => context.workbench.descriptor(id)?.title ?? id;
  const screenIcon = (id: string) => context.workbench.descriptor(id)?.icon;

  const onkeydown = (event: KeyboardEvent) => {
    const index = current.screens.indexOf(current.activeScreen ?? '');
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta || index < 0) return;
    event.preventDefault();
    const next =
      current.screens[(index + delta + current.screens.length) % current.screens.length]!;
    context.layout.showScreen(next);
    (event.currentTarget as HTMLElement)
      .querySelector<HTMLElement>(`[data-screen="${CSS.escape(next)}"]`)
      ?.focus();
  };
</script>

<header class="top">
  <div class="start">
    {@render brand?.()}
    <nav class="menus" aria-label="Main menu">
      {#each [...$menuBar].sort((a, b) => a.value.order - b.value.order) as entry (entry.value.id)}
        <MenuBarMenu id={entry.value.id} title={entry.value.title} />
      {/each}
    </nav>
  </div>

  <div class="screens" role="tablist" aria-label="Main screens" tabindex="-1" {onkeydown}>
    {#each current.screens as screen (screen)}
      <button
        type="button"
        role="tab"
        class="screen"
        data-screen={screen}
        aria-selected={current.activeScreen === screen}
        tabindex={current.activeScreen === screen ? 0 : -1}
        onclick={() => context.layout.showScreen(screen)}
      >
        {#if screenIcon(screen)}<Icon name={screenIcon(screen)} size={15} />{/if}
        {screenTitle(screen)}
      </button>
    {/each}
  </div>

  <div class="end" role="toolbar" aria-label="Run">
    {#each tools as { item, pressed } (item.id)}
      <IconButton
        icon={item.icon}
        label={item.title}
        {pressed}
        onclick={() =>
          context.commands
            .execute(item.command, ...(item.args ?? []))
            .catch((error: unknown) => context.logger.error(`${item.command} failed`, error))}
      />
    {/each}
  </div>
</header>

<style>
  .top {
    display: grid;
    /* The sides keep their content; in a narrow window the screens give way and scroll. */
    grid-template-columns: minmax(max-content, 1fr) minmax(0, auto) minmax(max-content, 1fr);
    align-items: center;
    height: 36px;
    padding: 0 var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
    background: var(--nf-color-bg);
  }
  .start,
  .end {
    display: flex;
    align-items: center;
    gap: var(--nf-space-2);
    min-width: 0;
  }
  .end {
    justify-content: flex-end;
  }
  .menus {
    display: flex;
  }
  .screens {
    display: flex;
    gap: var(--nf-space-1);
    height: 100%;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .screen {
    position: relative;
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 var(--nf-space-3);
    border: 0;
    background: transparent;
    color: var(--nf-color-text-muted);
    font-weight: 500;
    cursor: pointer;
  }
  .screen:hover {
    color: var(--nf-color-text);
  }
  .screen[aria-selected='true'] {
    color: var(--nf-color-text);
  }
  /* The temper gradient: the one decorative accent of the UI. */
  .screen[aria-selected='true']::after {
    content: '';
    position: absolute;
    left: var(--nf-space-2);
    right: var(--nf-space-2);
    bottom: 0;
    height: 2px;
    border-radius: 1px;
    background: var(--nf-temper);
  }
</style>
