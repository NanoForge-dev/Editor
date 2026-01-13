<script lang="ts">
  import Panel from './Panel.svelte';
  import Widget from './Widget.svelte';
  import WidgetResizeBar from './WidgetResizeBar.svelte';
  import type { LayoutItem } from './types';
  import { isWidget, isPanel } from './utils';
  import Self from './Layout.svelte';

  interface Props {
    layout: LayoutItem;
    onLayoutChange?: (newLayout: LayoutItem) => void;
    path?: number[];
  }

  let { layout, onLayoutChange, path = [] }: Props = $props();

  let dragStartSizes = $state(new Map<string, number>());

  function getDragKey(childIndex: number, side: 'left' | 'right'): string {
    return `${path.join(',')}-${childIndex}-${side}`;
  }

  function handleResize(childIndex: number, delta: number) {
    if (!isPanel(layout) || !onLayoutChange) return;

    const leftChild = layout.children[childIndex];
    const rightChild = layout.children[childIndex + 1];

    if (!leftChild || !rightChild) return;

    const leftKey = getDragKey(childIndex, 'left');
    const rightKey = getDragKey(childIndex, 'right');

    const leftInitialSize = dragStartSizes.get(leftKey) ?? leftChild.size ?? 50;
    const rightInitialSize = dragStartSizes.get(rightKey) ?? rightChild.size ?? 50;

    const newLayout = { ...layout };
    newLayout.children = [...layout.children];

    const newLeftSize = Math.max(5, Math.min(95, leftInitialSize + delta));
    const newRightSize = Math.max(5, Math.min(95, rightInitialSize - delta));

    const totalSize = newLeftSize + newRightSize;
    const leftRatio = newLeftSize / totalSize;
    const rightRatio = newRightSize / totalSize;
    const targetTotal = leftInitialSize + rightInitialSize;

    newLayout.children[childIndex] = {
      ...leftChild,
      size: leftRatio * targetTotal,
    };
    newLayout.children[childIndex + 1] = {
      ...rightChild,
      size: rightRatio * targetTotal,
    };

    onLayoutChange(newLayout);
  }

  function handleChildLayoutChange(childIndex: number) {
    return (newChildLayout: LayoutItem) => {
      if (!isPanel(layout) || !onLayoutChange) return;

      const newLayout = { ...layout };
      newLayout.children = [...layout.children];
      newLayout.children[childIndex] = newChildLayout;

      onLayoutChange(newLayout);
    };
  }

  function handleDragStart(childIndex: number) {
    if (!isPanel(layout)) return;

    const leftChild = layout.children[childIndex];
    const rightChild = layout.children[childIndex + 1];

    if (!leftChild || !rightChild) return;

    const leftKey = getDragKey(childIndex, 'left');
    const rightKey = getDragKey(childIndex, 'right');

    dragStartSizes.set(leftKey, leftChild.size ?? 50);
    dragStartSizes.set(rightKey, rightChild.size ?? 50);
  }

  function handleDragEnd(childIndex: number) {
    const leftKey = getDragKey(childIndex, 'left');
    const rightKey = getDragKey(childIndex, 'right');

    dragStartSizes.delete(leftKey);
    dragStartSizes.delete(rightKey);
  }
</script>

{#if isWidget(layout)}
  <Widget size={layout.size} id={layout.id} />
{:else if isPanel(layout)}
  <Panel direction={layout.direction} size={layout.size}>
    {#each layout.children as child, index (index)}
      <Self
        layout={child}
        onLayoutChange={handleChildLayoutChange(index)}
        path={[...path, index]}
      />

      {#if index < layout.children.length - 1}
        <WidgetResizeBar
          direction={layout.direction}
          onResize={(delta) => handleResize(index, delta)}
          onDragStart={() => handleDragStart(index)}
          onDragEnd={() => handleDragEnd(index)}
        />
      {/if}
    {/each}
  </Panel>
{/if}
