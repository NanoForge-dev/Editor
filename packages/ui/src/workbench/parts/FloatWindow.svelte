<script lang="ts">
  import type { FloatWindow } from '@nanoforge-dev/editor-layout';

  import Icon from '../../components/icon.svelte';
  import { getWorkbenchContext } from '../workbench-context';
  import DockStack from './DockStack.svelte';

  const { float }: { float: FloatWindow } = $props();
  const { layout, logger } = getWorkbenchContext();

  let preview = $state<{ x: number; y: number; width: number; height: number }>();
  const rect = $derived(preview ?? float);

  const track = (event: PointerEvent, mode: 'move' | 'resize') => {
    if (event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const start = {
      x: event.clientX,
      y: event.clientY,
      rect: { x: float.x, y: float.y, width: float.width, height: float.height },
    };
    const move = (e: PointerEvent) => {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      preview =
        mode === 'move'
          ? { ...start.rect, x: start.rect.x + dx, y: Math.max(0, start.rect.y + dy) }
          : { ...start.rect, width: start.rect.width + dx, height: start.rect.height + dy };
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      const final = preview;
      preview = undefined;
      if (final) {
        layout
          .apply(
            { type: 'setFloatRect', floatId: float.id, rect: final },
            mode === 'move' ? 'Move window' : 'Resize window',
          )
          .catch((error: unknown) => logger.error('Window change failed', error));
      }
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };
</script>

<div
  class="float"
  role="dialog"
  aria-label="Floating panel"
  data-float-id={float.id}
  style:left="{rect.x}px"
  style:top="{rect.y}px"
  style:width="{rect.width}px"
  style:height="{rect.height}px"
  style:z-index={100 + float.z}
  onpointerdowncapture={() => layout.raise(float.id)}
>
  <DockStack stack={float.stack} floatId={float.id}>
    {#snippet leading()}
      <span
        class="grip"
        role="presentation"
        title="Move window"
        onpointerdown={(event) => track(event, 'move')}
      >
        <Icon name="grip-vertical" size={14} />
      </span>
    {/snippet}
  </DockStack>
  <span
    class="resize"
    role="presentation"
    title="Resize window"
    onpointerdown={(event) => track(event, 'resize')}
  ></span>
</div>

<style>
  .float {
    position: absolute;
    overflow: hidden;
    border: 1px solid var(--nf-color-border-strong);
    border-radius: var(--nf-radius-float);
    box-shadow: var(--nf-shadow-float);
  }
  .grip {
    display: grid;
    place-items: center;
    width: 22px;
    flex: none;
    color: var(--nf-color-text-faint);
    cursor: move;
    touch-action: none;
  }
  .grip:hover {
    color: var(--nf-color-text);
  }
  .resize {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 14px;
    height: 14px;
    cursor: nwse-resize;
    touch-action: none;
    background: linear-gradient(135deg, transparent 50%, var(--nf-color-border-strong) 50%);
  }
</style>
