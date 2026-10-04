<script lang="ts">
  import {
    type EngineViewport,
    ProjectServiceToken,
    RuntimeServiceToken,
  } from '@nanoforge-dev/editor-sdk';

  import { EcsServiceToken } from '../../service/ecs-service';
  import { ecsData } from '../../service/ecs-data';
  import { moveInGame } from '../../live/move-in-game';
  import { LiveServiceToken } from '../../live/live-service';
  import type { EntryModel } from '../../model/ecs-model.type';
  import { type SceneShape, buildScene, withLivePositions } from '../../scene/build-scene';
  import { panelServices } from '../../session/panel-services';

  const services = panelServices();
  const ecs = services.get(EcsServiceToken);
  const live = services.get(LiveServiceToken);
  const runtime = services.tryGet(RuntimeServiceToken);
  const project = services.get(ProjectServiceToken).current;
  const instances = live.instances;
  const liveSelection = live.selection;
  const entryModel = ecs.model;
  const location = ecs.location;
  const catalog = ecs.catalogState;
  const active = moveInGame;

  const client = $derived($instances.find((candidate) => candidate.source === 'client'));

  /** How game coordinates map to this box (engine `viewport` events, asked for while active). */
  let viewport = $state<EngineViewport>();
  $effect(() => {
    if (!$active || !runtime) return;
    const events = runtime.onEvent(({ source, event, args }) => {
      if (source === 'client' && event === 'viewport' && args[0])
        viewport = args[0] as EngineViewport;
    });
    const features = runtime.useFeatures({ viewport: true });
    return () => {
      events.dispose();
      features.dispose();
      viewport = undefined;
    };
  });

  /** The entities of the client's main.ts (the app the Hierarchy shows may be another). */
  let model = $state<EntryModel>();
  $effect(() => {
    void $entryModel;
    const app = $project?.model.get().apps.find((candidate) => candidate.id === client?.app);
    if (!$active || !app) {
      model = undefined;
      return;
    }
    let current = true;
    void ecs.analyzeApp(app).then((next) => {
      if (current) model = next;
    });
    return () => {
      current = false;
    };
  });

  const shapes = $derived.by((): SceneShape[] => {
    void $catalog;
    if (!client) return [];
    const code = buildScene(
      model,
      (ref) => ecs.item(ref),
      (item, className) => {
        const data = ecsData(item);
        return data?.type === 'component' ? data.name : (className ?? '');
      },
    );
    return withLivePositions(code, client.entities, $location?.scene).filter(
      (shape) => shape.position,
    );
  });
  const selected = $derived(
    client && $liveSelection?.source === 'client'
      ? client.entities.find((entity) => entity.id === $liveSelection.id)?.code
      : undefined,
  );

  let svg = $state<SVGSVGElement>();
  let drag = $state<{ entity: string; dx: number; dy: number; startX: number; startY: number }>();

  /** The game point under the pointer. */
  const toGame = (event: PointerEvent) => {
    const box = svg!.getBoundingClientRect();
    const view = viewport!;
    return {
      x: (event.clientX - box.left - view.contentLeft - view.originX) / view.scaleX,
      y: (event.clientY - box.top - view.contentTop - view.originY) / view.scaleY,
    };
  };

  const entityOf = (shape: SceneShape) =>
    client?.entities.find(
      (candidate) => candidate.code === shape.entity && candidate.scene === $location?.scene,
    );

  const start = (event: PointerEvent, shape: SceneShape) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const entity = entityOf(shape);
    live.select(entity ? { source: 'client', id: entity.id } : undefined);
    const point = toGame(event);
    drag = { entity: shape.entity, dx: 0, dy: 0, startX: point.x, startY: point.y };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  };

  const move = (event: PointerEvent) => {
    if (!drag) return;
    const point = toGame(event);
    drag = {
      ...drag,
      dx: Math.round(point.x - drag.startX),
      dy: Math.round(point.y - drag.startY),
    };
  };

  /** Moves the entity in the running game: a live edit, which _Apply to code_ writes. */
  const end = () => {
    const current = drag;
    drag = undefined;
    if (!current || (!current.dx && !current.dy)) return;
    const shape = shapes.find((candidate) => candidate.entity === current.entity);
    const entity = shape && entityOf(shape);
    if (!shape?.position || !entity) return;
    live.setField('client', entity, shape.position.componentName, 'x', shape.x + current.dx);
    live.setField('client', entity, shape.position.componentName, 'y', shape.y + current.dy);
  };

  const offset = (shape: SceneShape) =>
    drag && drag.entity === shape.entity ? { x: drag.dx, y: drag.dy } : { x: 0, y: 0 };
</script>

{#if $active && viewport}
  <svg
    bind:this={svg}
    class="move"
    role="application"
    aria-label="Move entities in the game"
    onpointermove={move}
    onpointerup={end}
    onpointercancel={() => (drag = undefined)}
  >
    <g
      transform="translate({viewport.contentLeft + viewport.originX} {viewport.contentTop +
        viewport.originY}) scale({viewport.scaleX} {viewport.scaleY})"
    >
      {#each shapes as shape, index (`${shape.entity}:${index}`)}
        {@const delta = offset(shape)}
        <g
          role="button"
          tabindex="-1"
          aria-label="Move {shape.entity}"
          aria-pressed={shape.entity === selected}
          class:selected={shape.entity === selected}
          class:dragged={drag?.entity === shape.entity}
          transform="translate({shape.x + delta.x} {shape.y + delta.y})"
          onpointerdown={(event) => start(event, shape)}
        >
          {#if shape.kind === 'rect'}
            <rect width={shape.width} height={shape.height} />
          {:else}
            <circle r={shape.radius} />
          {/if}
        </g>
      {/each}
    </g>
  </svg>
{/if}

<style>
  .move {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    cursor: default;
    touch-action: none;
  }
  .move g[role='button'] {
    cursor: move;
  }
  .move rect,
  .move circle {
    fill: transparent;
    stroke: var(--nf-color-accent);
    stroke-dasharray: 4 3;
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
  }
  .move g[role='button']:hover rect,
  .move g[role='button']:hover circle,
  .move .selected rect,
  .move .selected circle {
    stroke-dasharray: none;
    stroke-width: 2px;
  }
  .move .dragged rect,
  .move .dragged circle {
    fill: color-mix(in srgb, var(--nf-color-accent) 25%, transparent);
  }
</style>
