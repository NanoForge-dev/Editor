<script lang="ts">
  import {
    EditorServices,
    HISTORY_CONTEXT_KEY,
    HistoryServiceToken,
  } from '@nanoforge-dev/editor-sdk';
  import {
    Button,
    Dialog,
    EmptyState,
    Input,
    Switch,
    type WidgetInstance,
  } from '@nanoforge-dev/editor-sdk/ui';

  import ContextSection from './ContextSection.svelte';

  const { instance }: { instance: WidgetInstance } = $props();
  // svelte-ignore state_referenced_locally
  const { services } = instance;
  const history = services.get(HistoryServiceToken);
  const contextKeys = services.get(EditorServices.ContextKeys);
  const contexts = history.contexts;

  // svelte-ignore state_referenced_locally
  let all = $state(instance.getState<{ all?: boolean }>()?.all ?? false);
  $effect(() => instance.setState({ all }));
  let query = $state('');
  let clearing = $state<string>();
  let now = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(timer);
  });

  /** What the user works on: the last focused widget with a history (not this panel). */
  let focused = $state<string | undefined>(
    contextKeys.get<string>(HISTORY_CONTEXT_KEY) ?? 'layout',
  );
  $effect(() => {
    const subscription = contextKeys.onDidChange(({ keys }) => {
      if (!keys.has(HISTORY_CONTEXT_KEY)) return;
      const id = contextKeys.get<string>(HISTORY_CONTEXT_KEY);
      if (id) focused = id;
    });
    return () => subscription.dispose();
  });

  const shown = $derived(all ? $contexts : $contexts.filter((context) => context.id === focused));
  const clearingLabel = $derived($contexts.find((context) => context.id === clearing)?.label);
</script>

<div class="history">
  <div class="toolbar">
    <Input bind:value={query} placeholder="Search changes" aria-label="Search changes" />
    <span class="all">
      <Switch bind:checked={all} label="All" />
      <span aria-hidden="true">All</span>
    </span>
  </div>
  <div class="list">
    {#each shown as context (context.id)}
      <ContextSection
        {context}
        local={history.localOrigin}
        {query}
        {now}
        collapsible={all}
        ongoto={(entryId) => void history.goTo(context.id, entryId)}
        onclear={() => (clearing = context.id)}
      />
    {:else}
      <EmptyState
        icon="history"
        title={all ? 'Nothing to undo yet' : 'No history here'}
        description={all
          ? undefined
          : 'Changes of the focused panel or document appear here. Switch on All to see every history.'}
      />
    {/each}
  </div>
</div>

<Dialog
  open={clearing !== undefined}
  title={`Clear the history of ${clearingLabel ?? ''}?`}
  description="Its changes stay; they just can't be undone anymore."
  onclose={() => (clearing = undefined)}
>
  {#snippet footer()}
    <Button onclick={() => (clearing = undefined)}>Cancel</Button>
    <Button
      variant="danger"
      onclick={() => {
        const id = clearing;
        clearing = undefined;
        if (id) void history.clear(id);
      }}>Clear</Button
    >
  {/snippet}
</Dialog>

<style>
  .history {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .toolbar {
    display: flex;
    flex: none;
    gap: var(--nf-space-2);
    align-items: center;
    padding: var(--nf-space-1) var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
  }
  .toolbar :global(input) {
    flex: 1;
    min-width: 0;
  }
  .all {
    display: inline-flex;
    gap: var(--nf-space-1);
    align-items: center;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .list {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
</style>
