<script lang="ts">
  import type { AppModel, CatalogItem } from '@nanoforge-dev/editor-sdk';
  import { Button, Menu, type MenuEntry } from '@nanoforge-dev/editor-sdk/ui';

  import type { EcsItemData } from '../../model/ecs-model.type';
  import { initialArgs } from '../../model/arg-values';
  import type { EcsService } from '../../service/ecs-service';

  interface Props {
    ecs: EcsService;
    item: CatalogItem;
    data: EcsItemData;
    /** Where it can be copied: the app, then the shared libraries. */
    targets: readonly AppModel[];
  }

  const { ecs, item, data, targets }: Props = $props();
  // svelte-ignore state_referenced_locally
  const selection = ecs.selection;
  // svelte-ignore state_referenced_locally
  const model = ecs.model;
  // svelte-ignore state_referenced_locally
  const location = ecs.location;

  const libraries = $derived(targets.filter((target) => target.type === 'lib'));

  const addToEntity = () => {
    const entity = $selection;
    if (!entity) return;
    void ecs.apply(
      {
        kind: 'addComponent',
        entity,
        className: item.meta.export,
        args: initialArgs(item.meta.params),
        imports: [ecs.importOf(item)],
      },
      `Add ${item.meta.export} to ${entity}`,
    );
  };

  const addToApp = () =>
    void ecs.apply(
      { kind: 'addSystem', name: item.meta.export, imports: [ecs.importOf(item)] },
      `Add ${item.meta.export}`,
    );

  const moveMenu = (): MenuEntry[] =>
    libraries.map((library) => ({
      kind: 'item',
      id: `move-${library.id}`,
      label: `Move to shared library ${library.name}`,
      onSelect: () => void ecs.moveToLibrary(item, library),
    }));

  const copyMenu = (): MenuEntry[] =>
    targets.map((target) => ({
      kind: 'item',
      id: `copy-${target.id}`,
      label:
        target.type === 'lib'
          ? `Copy to shared library ${target.name}`
          : `Copy to app ${target.name}`,
      onSelect: () => void ecs.copyTo(item, target),
    }));
</script>

<section class="details" aria-label="Details of {item.meta.export}">
  <h3>
    {item.meta.export}
    <span class="muted">{data.type} · {item.meta.side}</span>
  </h3>
  {#if item.meta.description}<p>{item.meta.description}</p>{/if}
  {#if data.type === 'component' && item.meta.params.length}
    <ul class="params">
      {#each item.meta.params as param (param.name)}
        <li>
          <code>{param.name}</code>
          <span class="muted">{param.type}</span>{#if param.description}
            — {param.description}{/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#if data.type === 'system'}
    {#if data.query.length}
      <p class="muted">
        Reads {data.query
          .map((list) => list.map((ref) => ref.slice(ref.indexOf('#') + 1)).join(' + '))
          .join('; ')}
      </p>
    {/if}
    {#if data.uses.length}<p class="muted">
        Uses ctx.{data.uses.join(', ctx.')}
      </p>{/if}
  {/if}
  {#if item.meta.example}<pre>{item.meta.example}</pre>{/if}
  <div class="actions">
    {#if data.type === 'component'}
      <Button size="sm" disabled={!$selection || !$model?.found} onclick={addToEntity}>
        {$selection ? `Add to ${$selection}` : 'Select an entity to add it'}
      </Button>
    {:else}
      <Button size="sm" disabled={!$model?.found} onclick={addToApp}
        >{$location?.scope?.kind === 'method' ? 'Add to scene' : 'Add to app'}</Button
      >
    {/if}
    <Button size="sm" variant="ghost" onclick={() => void ecs.openItem(item)}>Open in code</Button>
    {#if item.source.kind === 'app' && libraries.length}
      <Menu items={moveMenu()}>
        {#snippet trigger({ props })}
          <Button {...props} size="sm" variant="ghost">Move to shared library</Button>
        {/snippet}
      </Menu>
    {:else if item.readonly}
      <Menu items={copyMenu()}>
        {#snippet trigger({ props })}
          <Button {...props} size="sm" variant="ghost">Copy to…</Button>
        {/snippet}
      </Menu>
    {/if}
  </div>
</section>

<style>
  .details {
    padding: var(--nf-space-2);
    border-top: 1px solid var(--nf-color-border);
  }
  h3 {
    margin: 0 0 var(--nf-space-1);
    font-size: var(--nf-font-size-sm);
    font-weight: 600;
  }
  p {
    margin: 0 0 var(--nf-space-1);
  }
  .muted {
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .params {
    margin: 0 0 var(--nf-space-1);
    padding-left: var(--nf-space-3, 16px);
  }
  pre {
    overflow: auto;
    font-size: var(--nf-font-size-sm);
  }
  .actions {
    display: flex;
    gap: var(--nf-space-2);
  }
</style>
