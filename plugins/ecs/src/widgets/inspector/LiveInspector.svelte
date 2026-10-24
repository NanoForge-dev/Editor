<script lang="ts">
  import type { CatalogItem, Element } from '@nanoforge-dev/editor-sdk';
  import { Button, Combobox, type WidgetInstance } from '@nanoforge-dev/editor-sdk/ui';

  import { EcsServiceToken } from '../../service/ecs-service';
  import { ecsData } from '../../service/ecs-data';
  import type { FieldEditor } from '../../extension/field-editor.extension-point';
  import type { ParamPreset } from '../../extension/param-preset.extension-point';
  import type { LiveEntity, LiveSource } from '../../live/live.type';
  import { LiveServiceToken } from '../../live/live-service';
  import type { ArgModel, ComponentUse } from '../../model/ecs-model.type';
  import { initialArgs } from '../../model/arg-values';
  import ComponentCard from './ComponentCard.svelte';

  interface Props {
    instance: WidgetInstance;
    source: LiveSource;
    app: string;
    entity: LiveEntity;
    editors: readonly FieldEditor[];
    presets: readonly ParamPreset[];
  }

  const { instance, source, app, entity, editors, presets }: Props = $props();
  // svelte-ignore state_referenced_locally
  const ecs = instance.services.get(EcsServiceToken);
  // svelte-ignore state_referenced_locally
  const live = instance.services.get(LiveServiceToken);
  const catalog = ecs.catalogState;
  const pending = live.pending;

  const title = $derived(
    entity.code ?? (entity.codeOnlyLine ? `Line ${entity.codeOnlyLine}` : `Entity ${entity.id}`),
  );

  /** The catalog item of a live component (by its ECS registry name). */
  const itemFor = (name: string): CatalogItem | undefined => {
    void $catalog;
    return ($catalog?.items ?? []).find((item) => {
      const data = ecsData(item);
      return data?.type === 'component' && data.name === name;
    });
  };

  /** Params of a component without a catalog item: its fields, typed by their values. */
  const fieldsOf = (value: Record<string, unknown>): Element[] =>
    Object.entries(value)
      .filter(([key]) => key !== '$class' && key !== 'name')
      .map(([name, field]) =>
        typeof field === 'number'
          ? { type: 'number', name }
          : typeof field === 'string'
            ? { type: 'string', name }
            : typeof field === 'boolean'
              ? { type: 'boolean', name }
              : { type: 'unknown', name, tsType: '' },
      );

  /** An object of the running game in one readable line: `Circle { radius: 30, fill: "red", … }`. */
  const summary = (field: object): string => {
    if (Array.isArray(field)) return `[${field.length} ${field.length === 1 ? 'item' : 'items'}]`;
    const entries = Object.entries(field).filter(([key]) => key !== '$class');
    const plain = entries.filter(([, value]) => value === null || typeof value !== 'object');
    const shown = plain.slice(0, 4).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
    if (entries.length > shown.length) shown.push('…');
    const name = (field as { $class?: unknown }).$class;
    return `${typeof name === 'string' ? `${name} ` : ''}{ ${shown.join(', ')} }`;
  };

  const argsOf = (params: readonly Element[], value: Record<string, unknown>): ArgModel[] =>
    params.map((param) => {
      const field = value[param.name];
      const plain = field === null || typeof field !== 'object';
      return {
        code: plain ? JSON.stringify(field ?? null) : summary(field),
        start: 0,
        end: 0,
        ...(plain && field !== undefined && field !== null && { value: field }),
      };
    });

  /** A catalog-like item for a component the catalog doesn't know (its fields as params). */
  const fallbackItem = (name: string, params: readonly Element[]): CatalogItem =>
    ({
      ref: `live#${name}`,
      source: { kind: 'app', name: app, path: '' },
      readonly: true,
      meta: {
        export: name,
        source: '',
        kind: 'class',
        side: 'shared',
        params: [...params],
        fields: [],
        groups: [],
        requires: [],
      },
    }) as unknown as CatalogItem;

  const choices = $derived.by(() => {
    void $catalog;
    return ecs
      .items()
      .filter((item) => ecsData(item)?.type === 'component')
      .map((item) => ({ value: item.ref, label: item.meta.export }));
  });

  const add = (ref: string) => {
    const item = ecs.item(ref);
    const data = ecsData(item);
    if (!item || data?.type !== 'component') return;
    const args = initialArgs(item.meta.params).map((arg) =>
      'value' in arg ? arg.value : undefined,
    );
    live.addComponent(source, entity, data.name, args);
  };

  const changed = $derived((void $pending, live.hasPending(app, entity.key)));
</script>

<header class="live-header">
  <h2>{title}</h2>
  <span class="badge"
    >{entity.runtime ? 'runtime' : entity.codeOnlyLine ? 'from code' : 'live'}</span
  >
  <span class="spacer"></span>
  {#if entity.key}
    <Button size="sm" disabled={!changed} onclick={() => void live.applyToCode(app, entity.key!)}>
      Apply to code
    </Button>
  {/if}
</header>

{#each entity.components as component (component.name)}
  {@const item = itemFor(component.name)}
  {@const params = item?.meta.params ?? fieldsOf(component.value)}
  {@const use: ComponentUse = {
    node: { id: `live:${entity.id}:${component.name}`, path: '', kind: 'live', start: 0, end: 0 },
    className: component.name,
    ...(item && { item: item.ref }),
    args: argsOf(params, component.value),
    code: component.name,
    editable: true,
  }}
  <ComponentCard
    component={use}
    item={item ?? fallbackItem(component.name, params)}
    shown={ecs.shownFor(item?.ref)}
    first
    last
    {editors}
    {presets}
    onargs={(args) => {
      for (const [index, value] of Object.entries(args)) {
        const param = params[Number(index)];
        if (param && 'value' in value)
          live.setField(source, entity, component.name, param.name, value.value);
      }
    }}
    onshow={(id, visible) => item && ecs.setShown(item.ref, id, visible)}
    onmove={() => undefined}
    onremove={() => live.removeComponent(source, entity, component.name)}
    onopen={() => item && void ecs.openItem(item)}
  />
{/each}

<div class="add">
  <Combobox
    label="Add component to the game"
    placeholder="Add component…"
    value=""
    items={choices}
    onchange={add}
  />
</div>

<style>
  .live-header {
    display: flex;
    gap: var(--nf-space-2);
    align-items: center;
    padding: var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
  }
  h2 {
    margin: 0;
    font-size: var(--nf-font-size-md, 14px);
  }
  .badge {
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .spacer {
    flex: 1;
  }
  .add {
    padding: var(--nf-space-2);
  }
</style>
