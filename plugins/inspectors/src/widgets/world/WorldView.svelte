<script lang="ts">
  import { EmptyState, Icon, Input, type WidgetInstance } from '@nanoforge-dev/editor-sdk/ui';

  import JsonTree from '../JsonTree.svelte';
  import SourcePicker from '../SourcePicker.svelte';
  import { follow } from '../follow.svelte';
  import { getRecorder } from '../../session/recorder-session';
  import { filterEntities } from '../../world/world-query';

  const { instance }: { instance: WidgetInstance } = $props();
  // svelte-ignore state_referenced_locally
  const view = follow(getRecorder(), 'world', instance.visible);
  let query = $state('');
  let open = $state<readonly number[]>([]);

  const world = $derived(view.record?.world);
  const entities = $derived(world ? filterEntities(world.entities, query) : []);
  const toggle = (id: number) => {
    open = open.includes(id) ? open.filter((other) => other !== id) : [...open, id];
  };
</script>

<div class="world">
  {#if !world}
    <EmptyState
      icon="list-tree"
      title="No game is running"
      description="Play the game: its entities and their components appear here."
    />
  {:else}
    <div class="toolbar">
      <SourcePicker
        sources={view.sources}
        value={view.source ?? 'client'}
        onchange={(source) => (view.source = source)}
      />
      <Input
        bind:value={query}
        aria-label="World query"
        placeholder="Position   Position.x > 100   #12   &quot;text&quot;"
      />
      <span class="count" role="status"
        >{entities.length} of {world.entities.length}
        {world.entities.length === 1 ? 'entity' : 'entities'}</span
      >
    </div>
    <ul class="entities" aria-label="Entities of the running world">
      {#each entities as entity (entity.id)}
        {@const expanded = open.includes(entity.id)}
        <li aria-label={`Entity ${entity.id}`}>
          <button type="button" aria-expanded={expanded} onclick={() => toggle(entity.id)}>
            <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={12} />
            <span class="id">#{entity.id}</span>
            <span class="names"
              >{entity.components.map((c) => c.name).join(', ') || 'no component'}</span
            >
          </button>
          {#if expanded}
            <div class="components">
              {#each entity.components as component (component.name)}
                <JsonTree name={component.name} value={component.value} />
              {/each}
            </div>
          {/if}
        </li>
      {:else}
        <li class="none">No entity matches the query.</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .world {
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
  .count {
    flex: none;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .entities {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: var(--nf-space-1) var(--nf-space-2);
    overflow: auto;
    list-style: none;
    font-family: var(--nf-font-code);
    font-size: var(--nf-font-size-sm);
  }
  li > button {
    display: flex;
    gap: var(--nf-space-1);
    align-items: center;
    width: 100%;
    padding: 1px 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  li > button:hover {
    background: var(--nf-color-hover);
  }
  li > button:focus-visible {
    outline: 1px solid var(--nf-color-focus);
    outline-offset: -1px;
  }
  .id {
    color: var(--nf-color-accent);
  }
  .names {
    overflow: hidden;
    color: var(--nf-color-text-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .components {
    padding-left: var(--nf-space-4);
  }
  .none {
    padding: var(--nf-space-2) 0;
    color: var(--nf-color-text-muted);
    font-family: inherit;
  }
</style>
