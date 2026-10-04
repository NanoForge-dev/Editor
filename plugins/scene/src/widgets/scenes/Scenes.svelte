<script lang="ts">
  import {
    ContextMenu,
    type DropPosition,
    EmptyState,
    IconButton,
    type MenuEntry,
    PromptServiceToken,
    Tree,
    type WidgetInstance,
  } from '@nanoforge-dev/editor-sdk/ui';

  import { SceneLiveServiceToken } from '../../live/scene-live-service';
  import type { SceneModel } from '../../model/scene-model.type';
  import { MAIN_LABEL, SceneServiceToken } from '../../service/scene-service';
  import { SCENES_HISTORY } from '../../service/scene-history.const';
  import { validateSceneName } from '../../template/scene-template';
  import { askSceneParams } from './scene-prompts';
  import { MAIN_ID, sceneTree } from './scene-tree';

  const { instance }: { instance: WidgetInstance } = $props();
  // svelte-ignore state_referenced_locally
  const scenes = instance.services.get(SceneServiceToken);
  // svelte-ignore state_referenced_locally
  const prompts = instance.services.tryGet(PromptServiceToken);
  $effect(() => instance.setHistoryContext(SCENES_HISTORY));
  // svelte-ignore state_referenced_locally
  const live = instance.services.get(SceneLiveServiceToken);
  const games = live.games;
  // svelte-ignore state_referenced_locally
  const visible = instance.visible;
  $effect(() => {
    if (!$visible) return;
    const watching = live.watch();
    return () => watching.dispose();
  });
  const game = $derived($games.find((candidate) => candidate.app === $appId));
  const loadedIds = $derived(game?.loaded.map((scene) => scene.id) ?? []);

  const loadLive = async (scene: SceneModel, underCurrent: boolean) => {
    if (!game) return;
    const params = await askSceneParams(prompts, scene);
    if (!params) return;
    live.load(game, scene.id, params.value, underCurrent ? 'current' : undefined);
  };
  const model = scenes.model;
  const selectedByApp = scenes.selected;
  const appId = scenes.appId;

  let expanded = $state(new Set<string>());
  let menuTarget = $state<string>();
  let tree = $state<{ rename: (id: string) => void }>();
  const taken = () => ($model?.scenes ?? []).map((scene) => scene.className);

  const create = async (parent?: SceneModel) => {
    const name = await prompts?.ask({
      title: parent ? `New scene under ${parent.id}` : 'New scene',
      label: 'Name',
      value: 'Level',
      confirm: 'Create',
      validate: (value) => validateSceneName(value, taken()),
    });
    if (name) await scenes.newScene(name, parent);
  };

  const rename = (className: string, name: string) => {
    const scene = sceneOf(className);
    if (!scene || name === className) return;
    const problem = validateSceneName(name, taken());
    if (problem) return;
    void scenes.rename(scene, name);
  };

  /** Dropped inside a scene: under it; before or after: next to it (its parent). */
  const drop = (ids: string[], target: string, position: DropPosition) => {
    if (target === MAIN_ID) return;
    const scene = sceneOf(ids[0]);
    const onto = sceneOf(target);
    if (!scene || !onto || scene === onto) return;
    const parent = position === 'inside' ? onto : sceneOf(onto.parent);
    if (parent?.className === scene.parent || (!parent && !scene.parent)) return;
    void scenes.setParent(scene, parent);
  };

  const sceneOf = (className: string | undefined) =>
    $model?.scenes.find((scene) => scene.className === className);

  const nodes = $derived(sceneTree($model, loadedIds, MAIN_LABEL));

  $effect(() => {
    const parents = ($model?.scenes ?? [])
      .map((scene) => scene.parent)
      .filter((parent): parent is string => !!parent);
    if (parents.some((parent) => !expanded.has(parent)))
      expanded = new Set([...expanded, ...parents]);
  });

  const selected = $derived(new Set([($appId && $selectedByApp.get($appId)) || MAIN_ID]));

  const open = (className: string) => {
    const entry = scenes.app?.entryFile;
    if (className === MAIN_ID && entry) void scenes.openInCode(entry);
    const scene = sceneOf(className);
    if (scene) void scenes.openInCode(scene.path, scene.line);
  };

  const menu = (): MenuEntry[] => {
    const scene = sceneOf(menuTarget);
    if (!scene)
      return [{ kind: 'item', id: 'new', label: 'New scene…', onSelect: () => void create() }];
    const initial = scene.className === $model?.library?.initial;
    const liveEntries: MenuEntry[] = game
      ? [
          {
            kind: 'item',
            id: 'load',
            label: 'Load scene',
            onSelect: () => void loadLive(scene, false),
          },
          ...(!scene.parent
            ? [
                {
                  kind: 'item' as const,
                  id: 'load-under',
                  label: 'Load under the current scene',
                  disabled: !loadedIds.length,
                  onSelect: () => void loadLive(scene, true),
                },
              ]
            : []),
          {
            kind: 'item',
            id: 'unload',
            label: 'Unload scene',
            disabled: !loadedIds.includes(scene.id),
            onSelect: () => live.unload(game, scene.id),
          },
          { kind: 'separator' },
        ]
      : [];
    return [
      ...liveEntries,
      {
        kind: 'item',
        id: 'edit',
        label: 'Edit',
        onSelect: () => scenes.select(scene.className),
      },
      { kind: 'item', id: 'open', label: 'Open in code', onSelect: () => open(scene.className) },
      { kind: 'separator' },
      {
        kind: 'item',
        id: 'new-child',
        label: `New scene under ${scene.id}…`,
        onSelect: () => void create(scene),
      },
      {
        kind: 'item',
        id: 'initial',
        label: 'Set as initial scene',
        disabled: initial,
        onSelect: () => void scenes.setInitial(scene),
      },
      ...(scene.parent
        ? [
            {
              kind: 'item' as const,
              id: 'root',
              label: 'Move to the root',
              onSelect: () => void scenes.setParent(scene, undefined),
            },
          ]
        : []),
      {
        kind: 'item',
        id: 'rename',
        label: 'Rename',
        shortcut: 'F2',
        onSelect: () => setTimeout(() => tree?.rename(scene.className), 150),
      },
      { kind: 'separator' },
      {
        kind: 'item',
        id: 'delete',
        label: 'Delete',
        disabled: initial,
        onSelect: () => void scenes.delete(scene),
      },
    ];
  };
</script>

<div class="scenes">
  <div class="toolbar">
    <span class="title">{scenes.app?.name ?? ''}</span>
    <IconButton icon="plus" label="New scene" disabled={!$model} onclick={() => void create()} />
  </div>
  {#if !scenes.apps.length}
    <EmptyState
      icon="layers"
      title="No app with scenes"
      description="Apps that use @nanoforge-dev/scene show their scenes here."
    />
  {:else if !$model}
    <EmptyState icon="layers" title="Reading the scenes…" />
  {:else}
    <ContextMenu items={menu}>
      <div
        class="list"
        role="presentation"
        oncontextmenu={(event) => {
          if (!(event.target as HTMLElement).closest('[data-id]')) menuTarget = undefined;
        }}
      >
        <Tree
          bind:this={tree}
          label="Scenes"
          {nodes}
          bind:expanded
          {selected}
          onselectionchange={(next) => {
            const [className] = [...next];
            if (className) scenes.select(className === MAIN_ID ? undefined : className);
          }}
          onactivate={open}
          onrename={rename}
          ondrop={drop}
          oncontextmenu={(id) => (menuTarget = id)}
        />
      </div>
    </ContextMenu>
    {#if !$model.scenes.length}
      <EmptyState
        icon="layers"
        title="No scene yet"
        description="A scene is a class extending EcsScene in the app's scenes folder."
      />
    {/if}
  {/if}
  {#if $model?.problems.length}
    <ul class="problems" aria-label="Scene problems">
      {#each $model.problems as problem (problem)}
        <li>{problem}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .scenes {
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
  .title {
    flex: 1;
    overflow: hidden;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .list {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .problems {
    flex: none;
    margin: 0;
    padding: var(--nf-space-2) var(--nf-space-2) var(--nf-space-2) var(--nf-space-5, 24px);
    border-top: 1px solid var(--nf-color-border);
    color: var(--nf-color-warning, #e0a03a);
    font-size: var(--nf-font-size-sm);
  }
</style>
