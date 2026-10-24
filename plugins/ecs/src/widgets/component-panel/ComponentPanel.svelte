<script lang="ts">
  import { untrack } from 'svelte';

  import type { Element, ParamGroup } from '@nanoforge-dev/editor-sdk';
  import { Select } from '@nanoforge-dev/editor-sdk/ui';

  import { EcsServiceToken } from '../../service/ecs-service';
  import type { ComponentUse } from '../../model/ecs-model.type';
  import type { ItemDocsOp, ParamDocs } from '../../model/item-docs.type';
  import ComponentCard from '../inspector/ComponentCard.svelte';
  import GroupsSection from './GroupsSection.svelte';
  import ParamEditor from './ParamEditor.svelte';
  import { changedGroup, docsOf, nextGroupName, presetDoc, regrouped } from './component-docs';
  import { panelServices } from '../../session/panel-services';

  const { path }: { path: string } = $props();
  const ecs = panelServices().get(EcsServiceToken);
  const catalog = ecs.catalogState;

  let chosen = $state<string>();
  const opened = ecs.openedItem;
  $effect(() => {
    const ref = $opened;
    if (ref && untrack(() => ecs.componentsIn(path)).some((candidate) => candidate.ref === ref))
      chosen = ref;
  });
  const items = $derived.by(() => {
    void $catalog;
    return ecs.componentsIn(path);
  });
  const item = $derived(items.find((candidate) => candidate.ref === chosen) ?? items[0]);
  const meta = $derived(item?.meta);
  const readonly = $derived(item?.readonly ?? true);
  const params = $derived<readonly Element[]>(meta ? [...meta.params, ...meta.fields] : []);
  const groups = $derived<readonly ParamGroup[]>(meta?.groups ?? []);

  const write = (op: Omit<ItemDocsOp, 'export'>, label: string) => {
    if (!meta || readonly) return;
    void ecs.editDocs(path, { export: meta.export, ...op }, label);
  };

  const setParam = (element: Element, change: Partial<ParamDocs>, label: string) => {
    const docs = Object.fromEntries(
      Object.entries({ ...docsOf(element), ...change }).filter(
        ([, value]) => value !== undefined && value !== '',
      ),
    );
    write({ params: { [element.name]: docs as ParamDocs } }, label);
  };

  const setGroups = (
    next: readonly ParamGroup[],
    label: string,
    params?: Record<string, ParamDocs>,
  ) => write({ groups: next, ...(params && { params }) }, label);

  const renameGroup = (group: ParamGroup, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === group.name || groups.some((other) => other.name === trimmed))
      return;
    setGroups(
      groups.map((other) => (other === group ? { ...other, name: trimmed } : other)),
      `Rename group ${group.name}`,
      regrouped(params, group.name, trimmed),
    );
  };

  const removeGroup = (group: ParamGroup) =>
    setGroups(
      groups.filter((other) => other !== group),
      `Remove group ${group.name}`,
      regrouped(params, group.name, undefined),
    );

  const updateGroup = (group: ParamGroup, change: Partial<ParamGroup>, label: string) =>
    setGroups(
      groups.map((other) => (other === group ? changedGroup(other, change) : other)),
      label,
    );

  const newGroupFor = (element: Element) => {
    const name = nextGroupName(groups);
    setGroups([...groups, { name }], `Put ${element.name} in a new group`, {
      [element.name]: { ...docsOf(element), group: name },
    });
  };

  const setPreset = (element: Element, presetId: string | undefined) => {
    if (!presetId)
      return setParam(element, { preset: undefined }, `Remove the preset of ${element.name}`);
    const preset = presetDoc(params, element, presetId);
    if (preset) setParam(element, { preset }, `Set the preset of ${element.name}`);
  };

  const preview = $derived<ComponentUse | undefined>(
    meta && {
      node: { id: 'preview', path, kind: 'NewExpression', start: 0, end: 0 },
      className: meta.export,
      item: item?.ref,
      args: [],
      code: `new ${meta.export}()`,
      editable: true,
    },
  );
</script>

<div class="panel">
  {#if !meta}
    <p class="muted">No component in this file.</p>
  {:else}
    {#if items.length > 1}
      <Select
        label="Component to edit"
        value={item?.ref ?? ''}
        items={items.map((candidate) => ({ value: candidate.ref, label: candidate.meta.export }))}
        onchange={(ref) => (chosen = ref)}
      />
    {/if}
    {#if readonly}
      <p class="muted">An installed package: read-only. Copy it into your project to change it.</p>
    {/if}

    <section aria-label="Description">
      <h3>{meta.export}</h3>
      <textarea
        aria-label="Description of {meta.export}"
        placeholder="Description"
        disabled={readonly}
        value={meta.description ?? ''}
        onchange={(event) =>
          write(
            { description: (event.currentTarget as HTMLTextAreaElement).value.trim() },
            `Describe ${meta.export}`,
          )}></textarea>
    </section>

    <GroupsSection
      {groups}
      {readonly}
      onadd={() => setGroups([...groups, { name: nextGroupName(groups) }], 'Add a group')}
      onrename={renameGroup}
      onupdate={updateGroup}
      onremove={removeGroup}
    />

    <section aria-label="Params">
      <h3>Params</h3>
      {#each params as element (element.name)}
        <ParamEditor
          {element}
          {params}
          {groups}
          {readonly}
          onchange={(change, label) => setParam(element, change, label)}
          onnewgroup={() => newGroupFor(element)}
          onpreset={(presetId) => setPreset(element, presetId)}
        />
      {/each}
    </section>

    {#if preview}
      <section aria-label="Preview">
        <h3>Preview</h3>
        <ComponentCard
          component={preview}
          {item}
          shown={new Set()}
          first
          last
          onargs={() => undefined}
          onshow={() => undefined}
          onmove={() => undefined}
          onremove={() => undefined}
          onopen={() => undefined}
        />
      </section>
    {/if}
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--nf-space-2);
    padding: var(--nf-space-2);
  }
  section {
    display: flex;
    flex-direction: column;
    gap: var(--nf-space-1);
  }
  h3 {
    margin: 0;
    font-size: var(--nf-font-size-sm);
    font-weight: 600;
  }
  textarea {
    min-height: 48px;
    resize: vertical;
    font: inherit;
  }
  .muted {
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
</style>
