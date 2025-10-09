<script lang="ts">
  interface Props {
    direction: 'row' | 'col';
    onResize: (delta: number) => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
  }

  let { direction, onResize, onDragStart, onDragEnd }: Props = $props();

  const isHorizontal = direction === 'row';
  let isDragging = $state(false);
  let startPos = $state(0);

  function handleMouseDown(event: MouseEvent) {
    isDragging = true;
    startPos = isHorizontal ? event.clientX : event.clientY;

    event.preventDefault();
    document.body.style.userSelect = 'none';
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';

    onDragStart?.();
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isDragging) return;

    const currentPos = isHorizontal ? event.clientX : event.clientY;
    const totalDelta = currentPos - startPos;

    const container = document.querySelector('[data-layout-container]') as HTMLElement;
    if (container) {
      const containerSize = isHorizontal ? container.clientWidth : container.clientHeight;
      const percentageDelta = (totalDelta / containerSize) * 100;
      onResize(percentageDelta);
    }
  }

  function handleMouseUp() {
    if (isDragging) {
      isDragging = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      onDragEnd?.();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    const step = event.shiftKey ? 5 : 1;
    let delta = 0;

    switch (event.key) {
      case 'ArrowLeft':
        delta = isHorizontal ? -step : 0;
        break;
      case 'ArrowRight':
        delta = isHorizontal ? step : 0;
        break;
      case 'ArrowUp':
        delta = !isHorizontal ? -step : 0;
        break;
      case 'ArrowDown':
        delta = !isHorizontal ? step : 0;
        break;
      default:
        return;
    }

    if (delta !== 0) {
      event.preventDefault();
      onDragStart?.();
      onResize(delta);
      onDragEnd?.();
    }
  }

  $effect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  });
</script>

<button
  class="bg-neutral-900 hover:bg-neutral-800 focus:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors duration-150 border-0 p-0"
  class:w-1={isHorizontal}
  class:h-full={isHorizontal}
  class:h-1={!isHorizontal}
  class:w-full={!isHorizontal}
  class:cursor-col-resize={isHorizontal}
  class:cursor-row-resize={!isHorizontal}
  class:bg-blue-500={isDragging}
  aria-label={isHorizontal ? 'Resize columns' : 'Resize rows'}
  title={isHorizontal
    ? 'Drag to resize columns, or use arrow keys'
    : 'Drag to resize rows, or use arrow keys'}
  onmousedown={handleMouseDown}
  onkeydown={handleKeyDown}
>
  <span class="sr-only">
    {isHorizontal ? 'Column resizer' : 'Row resizer'}
  </span>
</button>
