<script lang="ts">
  import { type AppModel, ProjectServiceToken } from '@nanoforge-dev/editor-sdk';
  import {
    Button,
    EmptyState,
    Input,
    Menu,
    type MenuEntry,
    NotificationServiceToken,
    PromptServiceToken,
    type WidgetInstance,
  } from '@nanoforge-dev/editor-sdk/ui';

  import ItemDetails from './ItemDetails.svelte';
  import { browserSections, nameCollisions } from './browser-sections';
  import { createItemFlow, createLibraryFlow } from './create-flows';
  import { EcsServiceToken } from '../../service/ecs-service';
  import { REFACTORS_HISTORY, ecsData } from '../../service/ecs-data';

  const { instance }: { instance: WidgetInstance } = $props();
  // svelte-ignore state_referenced_locally
  const { services } = instance;
  const ecs = services.get(EcsServiceToken);
  const projects = services.get(ProjectServiceToken);
  const prompts = services.tryGet(PromptServiceToken);
  const notifications = services.tryGet(NotificationServiceToken);
  const catalog = ecs.catalogState;
  const appId = ecs.appId;

  $effect(() => instance.setHistoryContext(REFACTORS_HISTORY));

  let query = $state('');
  let selectedRef = $state<string>();

  const sections = $derived.by(() => {
    void $catalog;
    void $appId;
    return browserSections(ecs.items(), query);
  });

  /** Components the app can use that share an ECS name: the registry would mix them up. */
  const collisions = $derived.by(() => {
    void $catalog;
    void $appId;
    return nameCollisions(ecs.items());
  });

  const selected = $derived(selectedRef ? ecs.item(selectedRef) : undefined);
  const selectedData = $derived(ecsData(selected));

  const libraryModels = ecs.libraries;
  const libraryProblems = ecs.libraryProblems;
  const targets = $derived.by((): AppModel[] => {
    void $appId;
    return [...(ecs.app ? [ecs.app] : []), ...$libraryModels];
  });

  const flows = { ecs, projects, prompts, notifications };

  const newMenu = $derived.by((): MenuEntry[] => [
    ...targets.flatMap((target): MenuEntry[] => {
      const where = target.type === 'lib' ? `shared library ${target.name}` : `app ${target.name}`;
      return [
        {
          kind: 'item',
          id: `c-${target.id}`,
          label: `New component in ${where}`,
          onSelect: () => void createItemFlow(flows, 'component', target),
        },
        {
          kind: 'item',
          id: `s-${target.id}`,
          label: `New system in ${where}`,
          onSelect: () => void createItemFlow(flows, 'system', target),
        },
      ];
    }),
    { kind: 'separator' },
    {
      kind: 'item',
      id: 'lib',
      label: 'New shared library…',
      onSelect: () => void createLibraryFlow(flows),
    },
  ]);
</script>

<div class="browser">
  <div class="toolbar">
    <Input bind:value={query} placeholder="Search" aria-label="Search components and systems" />
    <Menu items={newMenu}>
      {#snippet trigger({ props })}
        <Button {...props} size="sm" icon="plus">New</Button>
      {/snippet}
    </Menu>
  </div>

  <div class="content">
    {#each $libraryProblems as problem (problem)}
      <p class="collision" role="alert">{problem}</p>
    {/each}
    {#each collisions as [name, items] (name)}
      <p class="collision" role="alert">
        {items.length} components are named “{name}”: {items
          .map((item) =>
            item.source.kind === 'app' ? `app ${item.source.name}` : item.source.name,
          )
          .join(', ')}. The ECS registry keys on the name: rename one.
      </p>
    {/each}
    <div class="list" aria-label="Components and systems">
      {#if !$catalog || $catalog.loading}
        <p class="muted">Reading components and systems…</p>
      {:else if !sections.length}
        <EmptyState
          icon="blocks"
          title={query ? 'No match' : 'No components or systems'}
          description={query ? undefined : 'Create one with New.'}
        />
      {/if}
      {#each sections as section (section.title)}
        <h3>
          {section.title}
          {#if section.readonly}<span class="lock" title="Read-only">🔒</span>{/if}
        </h3>
        {#each section.items as item (item.ref)}
          {@const data = ecsData(item)}
          <button
            class="item"
            class:active={item.ref === selectedRef}
            onclick={() => (selectedRef = item.ref)}
            ondblclick={() => void ecs.openItem(item)}
          >
            <span class="kind">{data?.type === 'system' ? 'S' : 'C'}</span>
            <span class="name">{item.meta.export}</span>
            {#if data?.inferred}<span
                class="hint"
                title="Recognized by its shape. Add @{data.type} to its documentation to declare it."
                >untagged</span
              >{/if}
          </button>
        {/each}
      {/each}
    </div>

    {#if selected && selectedData}
      <ItemDetails {ecs} item={selected} data={selectedData} {targets} />
    {/if}
  </div>
</div>

<style>
  .browser {
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
  .content {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow: auto;
  }
  h3 {
    margin: var(--nf-space-2) var(--nf-space-2) var(--nf-space-1);
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
    font-weight: 600;
  }
  .item {
    display: flex;
    gap: var(--nf-space-2);
    align-items: center;
    width: 100%;
    padding: 2px var(--nf-space-2);
    border: 0;
    background: none;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .item:hover,
  .item.active {
    background: var(--nf-color-hover, rgb(127 127 127 / 15%));
  }
  .kind {
    width: 16px;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
    text-align: center;
  }
  .hint,
  .muted {
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .collision {
    margin: var(--nf-space-2);
    color: var(--nf-color-warning, orange);
    font-size: var(--nf-font-size-sm);
  }
</style>
