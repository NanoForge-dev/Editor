<script lang="ts">
  interface Props {
    /** `vertical`: a vertical bar resizing horizontally (between columns). */
    orientation: 'vertical' | 'horizontal';
    /** Pixel delta since the drag started; `final` on release. */
    onresize: (delta: number, final: boolean) => void;
    label: string;
    /** Current size in px (for assistive technologies). */
    value?: number;
  }

  const { orientation, onresize, label, value }: Props = $props();
  let dragging = $state(false);

  const start = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    const origin = orientation === 'vertical' ? event.clientX : event.clientY;
    let delta = 0;
    dragging = true;
    const move = (e: PointerEvent) => {
      delta = (orientation === 'vertical' ? e.clientX : e.clientY) - origin;
      onresize(delta, false);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      dragging = false;
      onresize(delta, true);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };

  const onkeydown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 40 : 10;
    const keys =
      orientation === 'vertical' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    const index = keys.indexOf(event.key);
    if (index < 0) return;
    event.preventDefault();
    onresize(index === 0 ? -step : step, true);
  };
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="splitter {orientation}"
  class:dragging
  role="separator"
  aria-orientation={orientation}
  aria-label={label}
  aria-valuenow={value}
  tabindex="0"
  onpointerdown={start}
  {onkeydown}
></div>

<style>
  .splitter {
    position: relative;
    flex: none;
    z-index: 1;
    background: var(--nf-color-bg);
    touch-action: none;
  }
  .vertical {
    width: 4px;
    cursor: col-resize;
  }
  .horizontal {
    height: 4px;
    cursor: row-resize;
  }
  .splitter:hover,
  .dragging,
  .splitter:focus-visible {
    background: var(--nf-color-focus);
    outline: none;
  }
</style>
