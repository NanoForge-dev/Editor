<script lang="ts">
  import type { Snippet } from 'svelte';

  import { EditorServices, type ServiceAccessor } from '@nanoforge-dev/editor-sdk';
  import { IconButton, VIEWPORT_TOOLS, type ViewportScreen } from '@nanoforge-dev/editor-sdk/ui';

  interface Props {
    screen: ViewportScreen;
    services: ServiceAccessor;
    start?: Snippet;
  }

  const { screen, services, start }: Props = $props();
  // svelte-ignore state_referenced_locally
  const tools = services.get(EditorServices.Extensions).observe(VIEWPORT_TOOLS);
  // svelte-ignore state_referenced_locally
  const contextKeys = services.get(EditorServices.ContextKeys);
  // svelte-ignore state_referenced_locally
  const commands = services.get(EditorServices.Commands);

  /** Bumped when context keys change: `when` and `toggled` are re-evaluated. */
  let keys = $state(0);
  $effect(() => {
    const subscription = contextKeys.onDidChange(() => keys++);
    return () => subscription.dispose();
  });
  const visible = $derived.by(() => {
    void keys;
    return $tools
      .map((contribution) => contribution.value)
      .filter((tool) => tool.screen === screen && contextKeys.evaluate(tool.when))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((tool) => ({
        tool,
        pressed: tool.toggled ? contextKeys.evaluate(tool.toggled) : undefined,
      }));
  });
</script>

<div class="toolbar" role="toolbar" aria-label={screen === 'game' ? 'Game view' : 'Scene view'}>
  {@render start?.()}
  <span class="spacer"></span>
  {#each visible as { tool, pressed } (tool.id)}
    <IconButton
      icon={tool.icon}
      label={tool.title}
      {pressed}
      onclick={() => void commands.execute(tool.command)}
    />
  {/each}
</div>

<style>
  .toolbar {
    display: flex;
    flex: none;
    gap: var(--nf-space-1);
    align-items: center;
    height: 34px;
    padding: 0 var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
    background: var(--nf-color-surface);
  }
  .spacer {
    flex: 1;
  }
</style>
