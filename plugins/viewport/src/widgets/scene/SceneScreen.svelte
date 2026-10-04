<script lang="ts">
  import {
    CODEGEN_TARGETS,
    EditorServices,
    ProjectServiceToken,
    selectTarget,
  } from '@nanoforge-dev/editor-sdk';
  import {
    EmptyState,
    SCENE_EDITORS,
    type SceneEditor,
    VIEWPORT_OVERLAYS,
    type WidgetInstance,
  } from '@nanoforge-dev/editor-sdk/ui';

  import ViewportToolbar from '../ViewportToolbar.svelte';

  const { instance }: { instance: WidgetInstance } = $props();
  // svelte-ignore state_referenced_locally
  const { services } = instance;
  const extensions = services.get(EditorServices.Extensions);
  const editors = extensions.observe(SCENE_EDITORS);
  const targets = extensions.observe(CODEGEN_TARGETS);
  const overlays = extensions.observe(VIEWPORT_OVERLAYS);
  const project = services.get(ProjectServiceToken).current;

  /**
   * The scene editor for the codegen target of the project's first client app (else any app).
   * Choosing the app (client, server, lib) comes with the scene editor plugins.
   */
  const editor = $derived.by((): SceneEditor | undefined => {
    void $targets;
    const apps = $project?.model.get().apps ?? [];
    const app = apps.find((candidate) => candidate.type === 'client') ?? apps[0];
    const target = app ? selectTarget(extensions, app) : undefined;
    return $editors
      .map((contribution) => contribution.value)
      .find(
        (candidate) =>
          candidate.targets.includes('*') || (!!target && candidate.targets.includes(target.id)),
      );
  });

  let host = $state<HTMLElement>();
  $effect(() => {
    if (!host || !editor?.mount) return;
    const mounted = editor.mount(host);
    return () => mounted.dispose();
  });
</script>

<div class="screen">
  <ViewportToolbar screen="scene" {services} />
  <div class="area">
    {#if editor?.component}
      {@const Editor = editor.component}
      <Editor {instance} />
    {:else if editor?.mount}
      <div class="host" bind:this={host}></div>
    {:else}
      <EmptyState
        icon="layers"
        title="No scene editor"
        description="A scene editor plugin fills this screen: the ECS plugin adds one for games using @nanoforge-dev/ecs."
      />
    {/if}
    {#if editor}
      {#each $overlays.filter((overlay) => overlay.value.screen === 'scene') as overlay (overlay.value.id)}
        {@const Overlay = overlay.value.component}
        <Overlay />
      {/each}
    {/if}
  </div>
</div>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--nf-color-bg);
  }
  .area {
    position: relative;
    flex: 1;
    min-height: 0;
  }
  .host {
    position: absolute;
    inset: 0;
  }
</style>
