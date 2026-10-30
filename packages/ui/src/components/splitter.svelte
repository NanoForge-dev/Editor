<script lang="ts">
  interface Props {
    /** `vertical`: a vertical bar resizing horizontally (between columns). */
    orientation: 'vertical' | 'horizontal';
    /** Pixel delta since the drag started; `final` on release. */
    onresize: (delta: number, final: boolean) => void;
    label: string;
    /** Current size in px (for assistive technologies). */
    value?: number;
    /** Smallest and largest sizes in px, when known (for assistive technologies). */
    min?: number;
    max?: number;
  }

  const { orientation, onresize, label, value, min, max }: Props = $props();
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

  /**
   * Arrow keys resize by 10 px (40 with Shift). Presses in a row preview the size and become one
   * step (one undo) once the keys rest for a moment or the focus leaves.
   */
  let keyDelta = 0;
  let keyTimer: ReturnType<typeof setTimeout> | undefined;
  const commitKeys = () => {
    clearTimeout(keyTimer);
    keyTimer = undefined;
    if (!keyDelta) return;
    const delta = keyDelta;
    keyDelta = 0;
    onresize(delta, true);
  };
  $effect(() => () => clearTimeout(keyTimer));
  const onkeydown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 40 : 10;
    const keys =
      orientation === 'vertical' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    const index = keys.indexOf(event.key);
    if (index < 0) return;
    event.preventDefault();
    keyDelta += index === 0 ? -step : step;
    onresize(keyDelta, false);
    clearTimeout(keyTimer);
    keyTimer = setTimeout(commitKeys, 600);
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
  aria-valuemin={min}
  aria-valuemax={max}
  aria-valuetext={value === undefined ? undefined : `${Math.round(value)} pixels`}
  tabindex="0"
  onpointerdown={start}
  {onkeydown}
  onblur={commitKeys}
></div>

<style>
  .splitter {
    position: relative;
    flex: none;
    z-index: 1;
    background: var(--nf-color-bg);
    touch-action: none;
  }
  /** The bar is 4 px; it can be grabbed 4 px on each side of it too. */
  .splitter::before {
    content: '';
    position: absolute;
    inset: 0;
  }
  .vertical::before {
    inset: 0 -4px;
  }
  .horizontal::before {
    inset: -4px 0;
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
