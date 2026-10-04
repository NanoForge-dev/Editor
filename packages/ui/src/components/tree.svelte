<script lang="ts">
  import Icon from './icon.svelte';
  import { type DropPosition, TREE_DRAG_TYPE, type TreeNode, flattenTree } from './tree-model';

  interface Props {
    nodes: readonly TreeNode[];
    label: string;
    expanded?: Set<string>;
    selected?: Set<string>;
    rowHeight?: number;
    /** Double click or Enter. */
    onactivate?: (id: string) => void;
    /** Return false (or throw) to refuse the new name. */
    onrename?: (id: string, name: string) => unknown;
    /** Rows dropped on a target; enables drag and drop. */
    ondrop?: (ids: string[], targetId: string, position: DropPosition) => void;
    oncontextmenu?: (id: string, event: MouseEvent) => void;
    onselectionchange?: (selected: Set<string>) => void;
  }

  let {
    nodes,
    label,
    expanded = $bindable(new Set<string>()),
    selected = $bindable(new Set<string>()),
    rowHeight = 24,
    onactivate,
    onrename,
    ondrop,
    oncontextmenu,
    onselectionchange,
  }: Props = $props();

  const uid = `nf-tree-${Math.random().toString(36).slice(2, 8)}`;
  let focused = $state<string>();
  let anchor = $state<string>();
  let renaming = $state<string>();
  let renameValue = $state('');
  let scrollTop = $state(0);
  let viewport = $state(0);
  let container = $state<HTMLDivElement>();
  let drop = $state<{ id: string; position: DropPosition }>();

  const rows = $derived(flattenTree(nodes, expanded));
  const index = $derived(new Map(rows.map((row, i) => [row.node.id, i])));
  const OVERSCAN = 8;
  const first = $derived(Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN));
  const last = $derived(
    Math.min(rows.length, Math.ceil((scrollTop + viewport) / rowHeight) + OVERSCAN),
  );
  const visible = $derived(rows.slice(first, last));

  $effect(() => {
    if (!container) return;
    const observer = new ResizeObserver(() => (viewport = container!.clientHeight));
    observer.observe(container);
    viewport = container.clientHeight;
    return () => observer.disconnect();
  });

  const setSelection = (next: Set<string>) => {
    selected = next;
    onselectionchange?.(next);
  };

  const setExpanded = (id: string, open: boolean) => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- copied then assigned, never mutated in place
    const next = new Set(expanded);
    if (open) next.add(id);
    else next.delete(id);
    expanded = next;
  };

  const focusRow = (id: string | undefined) => {
    if (!id) return;
    focused = id;
    const i = index.get(id);
    if (i === undefined || !container) return;
    const top = i * rowHeight;
    if (top < container.scrollTop) container.scrollTop = top;
    else if (top + rowHeight > container.scrollTop + container.clientHeight) {
      container.scrollTop = top + rowHeight - container.clientHeight;
    }
  };

  const selectRange = (from: string, to: string) => {
    const a = index.get(from) ?? 0;
    const b = index.get(to) ?? 0;
    const [start, end] = a < b ? [a, b] : [b, a];

    setSelection(new Set(rows.slice(start, end + 1).map((row) => row.node.id)));
  };

  const click = (event: MouseEvent, id: string) => {
    container?.focus();
    if (event.shiftKey && anchor) selectRange(anchor, id);
    else if (event.ctrlKey || event.metaKey) {
      // eslint-disable-next-line svelte/prefer-svelte-reactivity -- copied then assigned, never mutated in place
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelection(next);
      anchor = id;
    } else {
      setSelection(new Set([id]));
      anchor = id;
    }
    focused = id;
  };

  /** Rename inputs appear after load: `autofocus` would be ignored by browsers. */
  const focusAndSelect = (input: HTMLInputElement) => {
    input.focus();
    const dot = input.value.lastIndexOf('.');
    input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
  };

  const startRename = (id: string) => {
    if (!onrename) return;
    const row = rows[index.get(id) ?? -1];
    if (!row) return;
    renaming = id;
    renameValue = row.node.label;
  };

  /** Starts renaming a row in place, like F2 (for a "Rename" menu entry). */
  export const rename = (id: string): void => startRename(id);

  const finishRename = async (commit: boolean) => {
    const id = renaming;
    renaming = undefined;
    container?.focus();
    if (!commit || !id) return;
    const current = rows[index.get(id) ?? -1]?.node.label;
    const name = renameValue.trim();
    if (!name || name === current) return;
    await onrename?.(id, name);
  };

  const onkeydown = (event: KeyboardEvent) => {
    if (renaming || !rows.length) return;
    const i = focused ? (index.get(focused) ?? 0) : -1;
    const row = rows[i];
    const move = (to: number) => {
      const target = rows[Math.min(rows.length - 1, Math.max(0, to))]!.node.id;
      focusRow(target);
      if (event.shiftKey && anchor) selectRange(anchor, target);
      else if (!event.ctrlKey && !event.metaKey) {
        setSelection(new Set([target]));
        anchor = target;
      }
    };
    switch (event.key) {
      case 'ArrowDown':
        move(i + 1);
        break;
      case 'ArrowUp':
        move(i < 0 ? 0 : i - 1);
        break;
      case 'Home':
        move(0);
        break;
      case 'End':
        move(rows.length - 1);
        break;
      case 'ArrowRight':
        if (!row) return move(0);
        if (row.expandable && !expanded.has(row.node.id)) setExpanded(row.node.id, true);
        else if (row.expandable) move(i + 1);
        break;
      case 'ArrowLeft':
        if (!row) return;
        if (row.expandable && expanded.has(row.node.id)) setExpanded(row.node.id, false);
        else if (row.parentId) move(index.get(row.parentId) ?? i);
        break;
      case 'Enter':
        if (row) onactivate?.(row.node.id);
        break;
      case 'F2':
        if (row) startRename(row.node.id);
        break;
      case ' ':
        if (row) {
          // eslint-disable-next-line svelte/prefer-svelte-reactivity -- copied then assigned, never mutated in place
          const next = new Set(selected);
          if (next.has(row.node.id)) next.delete(row.node.id);
          else next.add(row.node.id);
          setSelection(next);
        }
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const dragStart = (event: DragEvent, id: string) => {
    if (!ondrop || !event.dataTransfer) return;
    const ids = selected.has(id) ? [...selected] : [id];

    if (!selected.has(id)) setSelection(new Set([id]));
    event.dataTransfer.setData(TREE_DRAG_TYPE, JSON.stringify(ids));
    event.dataTransfer.effectAllowed = 'move';
  };

  const dragOver = (event: DragEvent, node: TreeNode, expandable: boolean) => {
    if (!ondrop || !event.dataTransfer?.types.includes(TREE_DRAG_TYPE)) return;
    event.preventDefault();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    const canNest = node.droppable ?? expandable;
    const position: DropPosition =
      ratio < 0.3 ? 'before' : ratio > 0.7 || !canNest ? 'after' : 'inside';
    drop = { id: node.id, position: canNest || position !== 'inside' ? position : 'after' };
  };

  const dropOn = (event: DragEvent) => {
    const target = drop;
    drop = undefined;
    const raw = event.dataTransfer?.getData(TREE_DRAG_TYPE);
    if (!target || !raw || !ondrop) return;
    event.preventDefault();
    const ids = (JSON.parse(raw) as string[]).filter((id) => id !== target.id);
    if (ids.length) ondrop(ids, target.id, target.position);
  };
</script>

<div
  class="tree"
  role="tree"
  aria-label={label}
  aria-multiselectable="true"
  aria-activedescendant={focused ? `${uid}-${focused}` : undefined}
  tabindex="0"
  bind:this={container}
  onscroll={() => (scrollTop = container!.scrollTop)}
  {onkeydown}
  onfocus={() => {
    if (!focused && rows[0]) focused = rows[0].node.id;
  }}
>
  <div class="spacer" style:height="{rows.length * rowHeight}px">
    {#each visible as row (row.node.id)}
      {@const node = row.node}
      {@const i = index.get(node.id) ?? 0}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        id="{uid}-{node.id}"
        data-id={node.id}
        class="row"
        class:selected={selected.has(node.id)}
        class:focused={focused === node.id}
        class:drop-before={drop?.id === node.id && drop.position === 'before'}
        class:drop-after={drop?.id === node.id && drop.position === 'after'}
        class:drop-inside={drop?.id === node.id && drop.position === 'inside'}
        role="treeitem"
        aria-level={row.depth + 1}
        aria-selected={selected.has(node.id)}
        aria-expanded={row.expandable ? expanded.has(node.id) : undefined}
        tabindex="-1"
        style:top="{i * rowHeight}px"
        style:height="{rowHeight}px"
        style:padding-left="{row.depth * 14 + 4}px"
        draggable={!!ondrop && node.draggable !== false && renaming !== node.id}
        onclick={(event) => click(event, node.id)}
        ondblclick={() => onactivate?.(node.id)}
        oncontextmenu={(event) => {
          if (!selected.has(node.id)) click(event, node.id);
          oncontextmenu?.(node.id, event);
        }}
        ondragstart={(event) => dragStart(event, node.id)}
        ondragover={(event) => dragOver(event, node, row.expandable)}
        ondragleave={() => drop?.id === node.id && (drop = undefined)}
        ondrop={dropOn}
      >
        <button
          type="button"
          class="twisty"
          tabindex="-1"
          aria-hidden="true"
          style:visibility={row.expandable ? 'visible' : 'hidden'}
          onclick={(event) => {
            event.stopPropagation();
            setExpanded(node.id, !expanded.has(node.id));
          }}
        >
          <Icon name={expanded.has(node.id) ? 'chevron-down' : 'chevron-right'} size={14} />
        </button>
        {#if node.icon}<span class="icon"><Icon name={node.icon} size={14} /></span>{/if}
        {#if renaming === node.id}
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="rename"
            aria-label="New name"
            bind:value={renameValue}
            use:focusAndSelect
            onclick={(event) => event.stopPropagation()}
            onkeydown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') void finishRename(true);
              else if (event.key === 'Escape') void finishRename(false);
            }}
            onblur={() => void finishRename(true)}
          />
        {:else}
          <span class="label">{node.label}</span>
          {#if node.detail}<span class="detail" data-tone={node.tone} title={node.detailTitle}
              >{node.detail}</span
            >{/if}
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .tree {
    position: relative;
    height: 100%;
    overflow: auto;
    outline: none;
    user-select: none;
  }
  .spacer {
    position: relative;
  }
  .row {
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    padding-right: var(--nf-space-2);
    white-space: nowrap;
    cursor: default;
  }
  .row:hover {
    background: var(--nf-color-hover);
  }
  .selected,
  .selected:hover {
    background: var(--nf-color-selection);
    color: var(--nf-color-selection-text);
  }
  .tree:focus-visible .focused {
    box-shadow: inset 0 0 0 1px var(--nf-color-focus);
  }
  .twisty {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    flex: none;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--nf-color-text-muted);
    cursor: pointer;
  }
  .icon {
    display: inline-grid;
    flex: none;
    color: var(--nf-color-text-muted);
  }
  .selected .icon {
    color: inherit;
  }
  .label {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* The detail only takes the room the label leaves: the label is cut last. */
  .detail {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--nf-color-text-faint);
    font-size: var(--nf-font-size-sm);
  }
  .detail[data-tone='modified'] {
    color: var(--nf-color-warning);
  }
  .detail[data-tone='added'] {
    color: var(--nf-color-success);
  }
  .detail[data-tone='deleted'],
  .detail[data-tone='conflict'] {
    color: var(--nf-color-danger);
  }
  .rename {
    flex: 1;
    min-width: 0;
    height: calc(100% - 4px);
    padding: 0 4px;
    border: 1px solid var(--nf-color-focus);
    border-radius: 2px;
    background: var(--nf-color-sunken);
    outline: none;
  }
  .drop-inside {
    box-shadow: inset 0 0 0 1px var(--nf-color-accent);
  }
  .drop-before {
    box-shadow: inset 0 2px 0 var(--nf-color-accent);
  }
  .drop-after {
    box-shadow: inset 0 -2px 0 var(--nf-color-accent);
  }
</style>
