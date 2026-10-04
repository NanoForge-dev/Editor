<script lang="ts">
  import { documentHistoryId } from '@nanoforge-dev/editor-sdk';
  import { Button, EmptyState, type WidgetInstance } from '@nanoforge-dev/editor-sdk/ui';

  import { EcsServiceToken } from '../../service/ecs-service';
  import { ecsData } from '../../service/ecs-data';
  import { LiveServiceToken } from '../../live/live-service';
  import { type SceneShape, buildScene, withLivePositions } from '../../scene/build-scene';
  import { panelServices } from '../../session/panel-services';

  /** The Scene screen hosting this view. */
  const { instance }: { instance?: WidgetInstance } = $props();
  const services = panelServices();
  const ecs = services.get(EcsServiceToken);
  const location = ecs.location;
  const inherited = ecs.inherited;
  $effect(() => {
    const path = $location?.path;
    instance?.setHistoryContext(path ? documentHistoryId(path) : undefined);
  });
  const live = services.get(LiveServiceToken);
  const model = ecs.model;
  const catalog = ecs.catalogState;
  const selection = ecs.selection;
  const playing = live.playing;
  const instances = live.instances;
  const liveSelection = live.selection;

  /** Design resolution of the game (the engine's default viewport). */
  const WIDTH = 1920;
  const HEIGHT = 1080;

  const client = $derived($instances.find((candidate) => candidate.source === 'client'));
  const componentName = (item: ReturnType<typeof ecs.item>, className: string | undefined) => {
    const data = ecsData(item);
    return data?.type === 'component' ? data.name : (className ?? '');
  };
  const codeShapes = $derived.by(() => {
    void $catalog;
    return buildScene($model, (ref) => ecs.item(ref), componentName);
  });
  /** The parent scenes' shapes: drawn under the edited ones, dimmed, not editable. */
  const inheritedShapes = $derived.by(() => {
    void $catalog;
    if ($playing) return [];
    return $inherited.flatMap(({ model: parentModel }) =>
      buildScene(parentModel, (ref) => ecs.item(ref), componentName),
    );
  });
  const shapes = $derived(
    $playing && client
      ? withLivePositions(codeShapes, client.entities, $location?.scene)
      : codeShapes,
  );

  const selectedEntity = $derived.by(() => {
    if ($playing && client && $liveSelection?.source === 'client')
      return client.entities.find(
        (entity) => entity.id === $liveSelection.id && entity.scene === $location?.scene,
      )?.code;
    return $selection;
  });

  /** The part of the world in view: the whole stage with a margin, until zoomed or panned. */
  const MARGIN = 0.05;
  const FIT = {
    x: -WIDTH * MARGIN,
    y: -HEIGHT * MARGIN,
    width: WIDTH * (1 + 2 * MARGIN),
    height: HEIGHT * (1 + 2 * MARGIN),
  };
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 16;
  let view = $state({ ...FIT });
  const zoom = $derived(FIT.width / view.width);
  const fitted = $derived(
    view.x === FIT.x && view.y === FIT.y && view.width === FIT.width && view.height === FIT.height,
  );

  let root = $state<HTMLElement>();
  let svg = $state<SVGSVGElement>();
  let pan = $state<{ clientX: number; clientY: number; x: number; y: number }>();
  let drag = $state<{ entity: string; dx: number; dy: number; startX: number; startY: number }>();

  const toScene = (event: MouseEvent) => {
    const point = svg!.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg!.getScreenCTM();
    return matrix ? point.matrixTransform(matrix.inverse()) : point;
  };

  const select = (shape: SceneShape) => {
    if ($playing && client) {
      const entity = client.entities.find(
        (candidate) => candidate.code === shape.entity && candidate.scene === $location?.scene,
      );
      live.select(entity ? { source: 'client', id: entity.id } : undefined);
    } else ecs.select(shape.entity);
  };

  /** Zooms around the pointer (a non-passive listener: the page must not scroll). */
  const wheel = (node: SVGSVGElement) => {
    const onwheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = toScene(event);
      const next = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, zoom * (event.deltaY > 0 ? 1 / 1.15 : 1.15)),
      );
      const ratio = zoom / next;
      view = {
        x: point.x - (point.x - view.x) * ratio,
        y: point.y - (point.y - view.y) * ratio,
        width: view.width * ratio,
        height: view.height * ratio,
      };
    };
    node.addEventListener('wheel', onwheel, { passive: false });
    return { destroy: () => node.removeEventListener('wheel', onwheel) };
  };

  /** Pointer down anywhere in the scene takes the focus, so Ctrl+Z undoes scene edits. */
  const focus = () => root?.focus({ preventScroll: true });

  /** Pans from the background, or from anywhere with the middle button. */
  const press = (event: PointerEvent) => {
    const onShape = !!(event.target as Element).closest('g[role="button"]');
    if (event.button !== 1 && (event.button !== 0 || onShape)) return;
    event.preventDefault();
    pan = { clientX: event.clientX, clientY: event.clientY, x: view.x, y: view.y };
    svg?.setPointerCapture(event.pointerId);
  };

  const start = (event: PointerEvent, shape: SceneShape) => {
    if (event.button !== 0) return;
    event.preventDefault();
    select(shape);
    if (!shape.position) return;
    const point = toScene(event);
    drag = { entity: shape.entity, dx: 0, dy: 0, startX: point.x, startY: point.y };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  };

  const move = (event: PointerEvent) => {
    if (pan && svg) {
      const box = svg.getBoundingClientRect();
      const scale = Math.min(box.width / view.width, box.height / view.height) || 1;
      view = {
        ...view,
        x: pan.x - (event.clientX - pan.clientX) / scale,
        y: pan.y - (event.clientY - pan.clientY) / scale,
      };
      return;
    }
    if (!drag) return;
    const point = toScene(event);
    drag = {
      ...drag,
      dx: Math.round(point.x - drag.startX),
      dy: Math.round(point.y - drag.startY),
    };
  };

  const end = () => {
    pan = undefined;
    const current = drag;
    drag = undefined;
    if (!current || (!current.dx && !current.dy)) return;
    const shape = shapes.find(
      (candidate) => candidate.entity === current.entity && candidate.position,
    );
    const position = shape?.position;
    if (!shape || !position) return;
    const x = shape.x + current.dx;
    const y = shape.y + current.dy;
    if ($playing && client) {
      const entity = client.entities.find(
        (candidate) => candidate.code === shape.entity && candidate.scene === $location?.scene,
      );
      if (!entity) return;
      live.setField('client', entity, position.componentName, 'x', x);
      live.setField('client', entity, position.componentName, 'y', y);
      return;
    }
    const fill = [x, y];
    void ecs.apply(
      {
        kind: 'setArgs',
        entity: shape.entity,
        index: position.component,
        args: { [position.xParam]: { value: fill[0] }, [position.yParam]: { value: fill[1] } },
        fill: [{ value: 0 }, { value: 0 }],
      },
      `Move ${shape.entity}`,
    );
  };

  const offset = (shape: SceneShape) =>
    drag && drag.entity === shape.entity ? { x: drag.dx, y: drag.dy } : { x: 0, y: 0 };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="scene" bind:this={root} tabindex="-1" onpointerdown={focus}>
  {#if !$model?.found}
    <EmptyState
      icon="layers"
      title="No scene to show"
      description="Apps using the ECS show their entities here, drawn from main.ts."
    />
  {:else}
    <svg
      bind:this={svg}
      viewBox="{view.x} {view.y} {view.width} {view.height}"
      class:panning={!!pan}
      use:wheel
      onpointerdown={press}
      preserveAspectRatio="xMidYMid meet"
      role="application"
      aria-label="2D scene"
      onpointermove={move}
      onpointerup={end}
      onpointercancel={() => {
        drag = undefined;
        pan = undefined;
      }}
    >
      <rect class="stage" x="0" y="0" width={WIDTH} height={HEIGHT} />
      {#each inheritedShapes as shape, index (`inherited:${shape.entity}:${index}`)}
        <g class="inherited" transform="translate({shape.x} {shape.y})" aria-hidden="true">
          {#if shape.kind === 'rect'}
            <rect
              width={shape.width}
              height={shape.height}
              fill={shape.fill ?? 'none'}
              stroke={shape.stroke}
            />
          {:else}
            <circle r={shape.radius} fill={shape.fill ?? 'none'} stroke={shape.stroke} />
          {/if}
        </g>
      {/each}
      {#each shapes as shape, index (`${shape.entity}:${index}`)}
        {@const delta = offset(shape)}
        {@const selected = shape.entity === selectedEntity}
        <g
          role="button"
          tabindex="-1"
          aria-label="{shape.entity} ({shape.kind})"
          aria-pressed={selected}
          class:selected
          class:movable={!!shape.position}
          transform="translate({shape.x + delta.x} {shape.y + delta.y})"
          onpointerdown={(event) => start(event, shape)}
        >
          {#if shape.kind === 'rect'}
            <rect
              width={shape.width}
              height={shape.height}
              fill={shape.fill ?? 'none'}
              stroke={shape.stroke}
            />
            {#if selected}<rect class="outline" width={shape.width} height={shape.height} />{/if}
          {:else}
            <circle r={shape.radius} fill={shape.fill ?? 'none'} stroke={shape.stroke} />
            {#if selected}<circle class="outline" r={shape.radius} />{/if}
          {/if}
        </g>
      {/each}
    </svg>
    <div class="tools">
      <span class="zoom" aria-label="Zoom">{Math.round(zoom * 100)}%</span>
      <Button size="sm" variant="ghost" disabled={fitted} onclick={() => (view = { ...FIT })}
        >Fit</Button
      >
    </div>
    <p class="hint">
      {$playing
        ? 'Dragging moves the entity in the running game.'
        : `Drag an entity to move it in ${$location?.label ?? 'main.ts'}.`}
      Scroll to zoom; drag the background or use the middle button to pan.
    </p>
  {/if}
</div>

<style>
  .scene {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--nf-color-sunken);
    outline: none;
  }
  svg.panning {
    cursor: grabbing;
  }
  .tools {
    position: absolute;
    top: var(--nf-space-2);
    right: var(--nf-space-2);
    display: flex;
    gap: var(--nf-space-2);
    align-items: center;
  }
  .zoom {
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
    font-variant-numeric: tabular-nums;
  }
  svg {
    flex: 1;
    width: 100%;
    min-height: 0;
    touch-action: none;
  }
  .stage {
    fill: #000;
  }
  g.inherited {
    opacity: 0.35;
    pointer-events: none;
  }
  g.movable {
    cursor: grab;
  }
  .outline {
    fill: none;
    stroke: var(--nf-color-accent, #4aa3ff);
    stroke-width: 4;
    stroke-dasharray: 12 6;
    pointer-events: none;
  }
  .hint {
    position: absolute;
    bottom: var(--nf-space-2);
    left: var(--nf-space-2);
    margin: 0;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
    pointer-events: none;
  }
</style>
