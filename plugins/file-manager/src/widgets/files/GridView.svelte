<script lang="ts">
  import { type FileEntry, basename, dirname } from '@nanoforge-dev/editor-sdk';
  import { type FileDecoration, Icon, IconButton } from '@nanoforge-dev/editor-sdk/ui';

  import type { FileManagerService } from '../../service/file-manager-service';

  interface Props {
    service: FileManagerService;
    folder: string;
    entries: readonly FileEntry[];
    selection: readonly string[];
    size: number;
    /** Marks from other plugins (git status…). */
    decorate: (entry: FileEntry) => FileDecoration | undefined;
    oncontext: (path: string | undefined) => void;
    onimport: (folder: string, files: File[]) => void;
  }

  const { service, folder, entries, selection, size, decorate, oncontext, onimport }: Props =
    $props();

  const IMAGE = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;
  const SOUND = /\.(mp3|wav|ogg|flac|m4a)$/i;
  let playing = $state<string>();
  let audio: HTMLAudioElement | undefined;
  let dropTarget = $state<string>();

  const select = (event: MouseEvent, path: string) => {
    if (event.ctrlKey || event.metaKey) {
      service.select(
        selection.includes(path) ? selection.filter((item) => item !== path) : [...selection, path],
      );
    } else service.select([path]);
    service.showFolder(folder);
  };

  const togglePlay = (path: string) => {
    audio?.pause();
    if (playing === path) {
      playing = undefined;
      return;
    }
    audio = new Audio(service.fileUrl(path));
    audio.onended = () => (playing = undefined);
    void audio.play();
    playing = path;
  };
  $effect(() => () => audio?.pause());

  /**
   * Keyboard of the grid: the arrows move between tiles (Up and Down by a row), Home and End to
   * the ends; Enter opens, Space selects (Ctrl adds), Backspace or Alt+Up goes to the parent.
   */
  const onGridKey = (event: KeyboardEvent) => {
    const grid = event.currentTarget as HTMLElement;
    const tiles = [...grid.querySelectorAll<HTMLElement>('[role="option"]')];
    if ((event.key === 'Backspace' || (event.altKey && event.key === 'ArrowUp')) && folder) {
      event.preventDefault();
      service.showFolder(dirname(folder));
      return;
    }
    if (!tiles.length) return;
    const index = tiles.indexOf(document.activeElement as HTMLElement);
    const columns = Math.max(
      1,
      tiles.filter((tile) => tile.offsetTop === tiles[0]!.offsetTop).length,
    );
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -columns,
      ArrowDown: columns,
    };
    let next: number | undefined;
    if (event.key in step) next = index < 0 ? 0 : index + step[event.key]!;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tiles.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      tiles[Math.min(tiles.length - 1, Math.max(0, next))]!.focus();
      return;
    }
    const path = tiles[index]?.dataset.path;
    if (!path) return;
    if (event.key === ' ') {
      event.preventDefault();
      service.select(
        event.ctrlKey || event.metaKey
          ? selection.includes(path)
            ? selection.filter((item) => item !== path)
            : [...selection, path]
          : [path],
      );
      service.showFolder(folder);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      void service.open(path);
    }
  };

  const dragStart = (event: DragEvent, path: string) => {
    const paths = selection.includes(path) ? selection : [path];
    event.dataTransfer?.setData('application/x-nanoforge-paths', JSON.stringify(paths));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  };

  const dragOver = (event: DragEvent, target: string) => {
    const types = event.dataTransfer?.types ?? [];
    if (!types.includes('Files') && !types.includes('application/x-nanoforge-paths')) return;
    event.preventDefault();
    dropTarget = target;
  };

  const drop = (event: DragEvent, target: string) => {
    event.preventDefault();
    event.stopPropagation();
    dropTarget = undefined;
    const files = [...(event.dataTransfer?.files ?? [])];
    if (files.length) return onimport(target, files);
    const raw = event.dataTransfer?.getData('application/x-nanoforge-paths');
    if (raw) void service.move(JSON.parse(raw) as string[], target);
  };
</script>

<div
  class="grid"
  role="listbox"
  aria-label={`Files in ${folder || 'the project'}`}
  aria-multiselectable="true"
  tabindex="0"
  aria-keyshortcuts="Backspace Alt+ArrowUp"
  style:--tile={`${size}px`}
  onkeydown={onGridKey}
  class:drop={dropTarget === folder}
  oncontextmenu={(event) => {
    if (event.target === event.currentTarget) oncontext(undefined);
  }}
  ondragover={(event) => dragOver(event, folder)}
  ondragleave={() => (dropTarget = undefined)}
  ondrop={(event) => drop(event, folder)}
>
  {#if folder}
    <button
      type="button"
      class="tile up"
      ondblclick={() => service.showFolder(dirname(folder))}
      onkeydown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        service.showFolder(dirname(folder));
      }}
      ondragover={(event) => dragOver(event, dirname(folder))}
      ondrop={(event) => drop(event, dirname(folder))}
      title="Parent folder"
    >
      <span class="preview"><Icon name="folder-open" size={28} /></span>
      <span class="name">..</span>
    </button>
  {/if}
  {#each entries as entry (entry.path)}
    {@const selected = selection.includes(entry.path)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="tile"
      class:selected
      class:drop={dropTarget === entry.path}
      role="option"
      aria-selected={selected}
      tabindex="-1"
      data-path={entry.path}
      title={entry.path}
      draggable={!service.readOnly(entry.path)}
      onclick={(event) => select(event, entry.path)}
      ondblclick={() => void service.open(entry.path)}
      oncontextmenu={() => {
        if (!selected) service.select([entry.path]);
        oncontext(entry.path);
      }}
      ondragstart={(event) => dragStart(event, entry.path)}
      ondragover={(event) => entry.kind === 'directory' && dragOver(event, entry.path)}
      ondrop={(event) => entry.kind === 'directory' && drop(event, entry.path)}
    >
      <span class="preview">
        {#if entry.kind === 'file' && IMAGE.test(entry.path)}
          <img src={service.fileUrl(entry.path, entry.mtime)} alt="" loading="lazy" />
        {:else if entry.kind === 'file' && SOUND.test(entry.path)}
          <Icon name="music" size={28} />
          <span class="play">
            <IconButton
              icon={playing === entry.path ? 'square' : 'play'}
              label={playing === entry.path
                ? `Stop ${basename(entry.path)}`
                : `Play ${basename(entry.path)}`}
              size={14}
              onclick={(event) => {
                event.stopPropagation();
                togglePlay(entry.path);
              }}
            />
          </span>
        {:else}
          <Icon name={service.iconOf(entry)} size={28} />
        {/if}
      </span>
      <span class="name">{basename(entry.path)}</span>
      {#if decorate(entry)}
        {@const decoration = decorate(entry)!}
        <span class="mark" data-tone={decoration.tone} title={decoration.tooltip}
          >{decoration.badge}</span
        >
      {/if}
    </div>
  {:else}
    <p class="empty">This folder is empty. Drop files here to import them.</p>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(var(--tile) + 16px), 1fr));
    align-content: start;
    gap: var(--nf-space-1);
    height: 100%;
    padding: var(--nf-space-2);
    overflow: auto;
    outline: none;
  }
  .grid.drop {
    box-shadow: inset 0 0 0 2px var(--nf-color-accent);
  }
  .tile {
    display: grid;
    justify-items: center;
    gap: var(--nf-space-1);
    padding: var(--nf-space-1);
    border: 0;
    border-radius: var(--nf-radius-control);
    background: transparent;
    color: var(--nf-color-text);
    font: inherit;
    cursor: pointer;
  }
  .tile:hover {
    background: var(--nf-color-hover);
  }
  .tile.selected {
    background: var(--nf-color-selection);
    color: var(--nf-color-selection-text);
  }
  .tile.drop {
    box-shadow: inset 0 0 0 2px var(--nf-color-accent);
  }
  .preview {
    position: relative;
    display: grid;
    place-items: center;
    width: var(--tile);
    height: var(--tile);
    border-radius: var(--nf-radius-control);
    background: var(--nf-color-sunken);
    color: var(--nf-color-text-muted);
    overflow: hidden;
  }
  .preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    /* Small sprites scale up sharp. */
    image-rendering: pixelated;
  }
  .play {
    position: absolute;
    right: 2px;
    bottom: 2px;
  }
  .name {
    max-width: calc(var(--tile) + 8px);
    overflow: hidden;
    font-size: var(--nf-font-size-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mark {
    font-size: var(--nf-font-size-xs, 11px);
    font-weight: 600;
    color: var(--nf-color-text-faint);
  }
  .mark[data-tone='modified'] {
    color: var(--nf-color-warning);
  }
  .mark[data-tone='added'] {
    color: var(--nf-color-success);
  }
  .mark[data-tone='deleted'],
  .mark[data-tone='conflict'] {
    color: var(--nf-color-danger);
  }
  .empty {
    grid-column: 1 / -1;
    margin: var(--nf-space-3);
    color: var(--nf-color-text-faint);
    font-size: var(--nf-font-size-sm);
  }
</style>
