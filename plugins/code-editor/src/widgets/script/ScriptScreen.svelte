<script lang="ts">
  import { untrack } from 'svelte';

  import { EditorServices } from '@nanoforge-dev/editor-sdk';
  import {
    CODE_EDITOR_SIDE_PANELS,
    type CodeEditorSidePanel,
    EmptyState,
    IconButton,
    type WidgetInstance,
  } from '@nanoforge-dev/editor-sdk/ui';

  import EditorGroupView from './EditorGroupView.svelte';
  import type { EditorLayout } from '../../service/code-editor.type';
  import { current } from '../../session/code-editor-session';

  const { instance }: { instance: WidgetInstance } = $props();
  const layout = $derived($current?.service.layout);

  // svelte-ignore state_referenced_locally
  const panelContributions = instance.services
    .get(EditorServices.Extensions)
    .observe(CODE_EDITOR_SIDE_PANELS);
  let panelRevision = $state(0);
  let panelOpen = $state(true);
  let chosenPanel = $state<string>();
  const activePath = $derived($layout?.groups[$layout.focused]?.active);
  const panels = $derived.by((): CodeEditorSidePanel[] => {
    void panelRevision;
    const path = activePath;
    if (!path) return [];
    return $panelContributions
      .map((contribution) => contribution.value)
      .filter((panel) => panel.appliesTo(path));
  });
  const panel = $derived(panels.find((candidate) => candidate.id === chosenPanel) ?? panels[0]);
  $effect(() => {
    const subscriptions = $panelContributions.flatMap((contribution) =>
      contribution.value.changes
        ? [contribution.value.changes.subscribe(() => untrack(() => (panelRevision += 1)))]
        : [],
    );
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  });

  $effect(() => {
    const service = $current?.service;
    if (!service) return;
    return untrack(() => {
      void service.restore(instance.getState<EditorLayout>());
      return service.layout.subscribe((value) => instance.setState(value));
    });
  });

  $effect(() => {
    const service = $current?.service;
    if (!service) return;
    return service.layout.subscribe((value) => {
      const path = value.groups[value.focused]?.active;
      instance.setHistoryContext(path ? `file:${path}` : undefined);
    });
  });

  $effect(() => {
    const service = $current?.service;
    if (!service) return;
    const onBlur = () => service.focusLost();
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  });
</script>

{#if $current && $layout}
  <div class="script">
    {#each $layout.groups as group, index (index)}
      <EditorGroupView
        service={$current.service}
        monaco={$current.monaco}
        {index}
        {group}
        focused={$layout.focused === index}
      />
    {/each}
    {#if panel && activePath}
      {#if panelOpen}
        <aside class="side-panel" aria-label="{panel.title} panel">
          <header>
            {#each panels as candidate (candidate.id)}
              <button
                class="panel-tab"
                aria-pressed={candidate === panel}
                onclick={() => (chosenPanel = candidate.id)}>{candidate.title}</button
              >
            {/each}
            <span class="spacer"></span>
            <IconButton
              icon="x"
              label="Hide the {panel.title} panel"
              onclick={() => (panelOpen = false)}
            />
          </header>
          <div class="panel-body">
            {#key `${panel.id}:${activePath}`}
              <panel.component path={activePath} />
            {/key}
          </div>
        </aside>
      {:else}
        <div class="side-toggle">
          <IconButton
            icon={panel.icon ?? 'panel-right'}
            label="Show the {panel.title} panel"
            onclick={() => (panelOpen = true)}
          />
        </div>
      {/if}
    {/if}
  </div>
{:else}
  <EmptyState icon="file-code" title="No project open" />
{/if}

<style>
  .script {
    display: flex;
    height: 100%;
    min-height: 0;
  }
  .side-panel {
    display: flex;
    flex: none;
    flex-direction: column;
    width: 320px;
    min-height: 0;
    border-left: 1px solid var(--nf-color-border);
  }
  .side-panel header {
    display: flex;
    gap: var(--nf-space-1);
    align-items: center;
    padding: 2px var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
  }
  .panel-tab {
    border: 0;
    background: none;
    color: var(--nf-color-text-muted);
    cursor: pointer;
  }
  .panel-tab[aria-pressed='true'] {
    color: inherit;
    font-weight: 600;
  }
  .spacer {
    flex: 1;
  }
  .panel-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .side-toggle {
    flex: none;
    padding: 2px;
    border-left: 1px solid var(--nf-color-border);
  }
</style>
