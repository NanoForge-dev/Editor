<script lang="ts">
  import { tick, untrack } from 'svelte';

  import {
    EditorServices,
    ProjectServiceToken,
    RuntimeServiceToken,
  } from '@nanoforge-dev/editor-sdk';
  import {
    Button,
    ContextMenu,
    EmptyState,
    IconButton,
    Input,
    Menu,
    type MenuEntry,
    type WidgetInstance,
  } from '@nanoforge-dev/editor-sdk/ui';

  import ConsoleLineRow from './ConsoleLineRow.svelte';
  import GroupChips from './GroupChips.svelte';
  import { consoleStats, sourcesMenu } from './console-filters';
  import type { ConsoleLine, LineLevel } from '../../store/console-store';
  import type { FileTarget } from '../../link/linkify';
  import { FrameLocator, createSegmenter } from '../../link/frame-locator';
  import { GROUPS, type GroupId, sourceLabel } from '../../store/log-sources';
  import { consoleStore } from '../../session/console-session';

  interface SavedState {
    groups?: Partial<Record<GroupId, boolean>>;
    hidden?: string[];
    levels?: Partial<Record<LineLevel, boolean>>;
  }

  const LEVELS = [
    { id: 'debug', label: 'Debug', icon: 'bug' },
    { id: 'info', label: 'Info', icon: 'info' },
    { id: 'warn', label: 'Warnings', icon: 'triangle-alert' },
    { id: 'error', label: 'Errors', icon: 'circle-alert' },
  ] as const;

  const { instance }: { instance: WidgetInstance } = $props();
  // svelte-ignore state_referenced_locally
  const { services } = instance;
  const commands = services.get(EditorServices.Commands);
  const store = consoleStore();

  // svelte-ignore state_referenced_locally
  const saved = instance.getState<SavedState>() ?? {};
  let groups = $state<Record<GroupId, boolean>>({
    ...(Object.fromEntries(GROUPS.map((group) => [group.id, group.shown])) as Record<
      GroupId,
      boolean
    >),
    ...saved.groups,
  });
  let hidden = $state<readonly string[]>(saved.hidden ?? []);
  let levels = $state<Record<LineLevel, boolean>>({
    debug: false,
    info: true,
    warn: true,
    error: true,
    ...saved.levels,
  });
  $effect(() =>
    instance.setState({ groups: { ...groups }, hidden: [...hidden], levels: { ...levels } }),
  );
  let query = $state('');

  let revision = $state(0);
  $effect(() => {
    let frame = 0;
    const unsubscribe = store.revision.subscribe(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        revision++;
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  });
  const lines = $derived.by(() => {
    void revision;
    return [...store.lines];
  });

  const needle = $derived(query.trim().toLowerCase());
  const visible = $derived(
    lines.filter(
      (line) =>
        groups[line.group] &&
        levels[line.level] &&
        !hidden.includes(line.source) &&
        (!needle ||
          line.text.toLowerCase().includes(needle) ||
          line.source.toLowerCase().includes(needle)),
    ),
  );

  /** Lines per group, and the warnings and errors a hidden group holds. */
  const stats = $derived(consoleStats(lines));

  const toggleSource = (source: string) => {
    hidden = hidden.includes(source)
      ? hidden.filter((other) => other !== source)
      : [...hidden, source];
  };
  const menu = $derived(sourcesMenu(lines, hidden, toggleSource, () => (hidden = [])));

  const exists = (path: string) =>
    services.tryGet(ProjectServiceToken)?.current.get()?.fs.entry(path)?.kind === 'file';
  const segmentsOf = createSegmenter(exists);
  const locator = new FrameLocator((frame) =>
    services.tryGet(RuntimeServiceToken)?.sourceLocation(frame.file, frame.line, frame.column),
  );
  const locate = locator.locate;
  const open = (target: FileTarget) =>
    void commands.execute('documents.open', target.path, {
      ...(target.line && { line: target.line, column: target.column ?? 1 }),
    });

  let list = $state<HTMLElement>();
  let follow = $state(true);
  const toBottom = () => {
    if (list) list.scrollTop = list.scrollHeight;
  };
  $effect(() => {
    void visible;
    if (untrack(() => follow)) void tick().then(toBottom);
  });
  const onscroll = () => {
    if (!list) return;
    follow = list.scrollTop + list.clientHeight >= list.scrollHeight - 8;
  };

  const clear = () => {
    store.clear();
    locator.clear();
    follow = true;
  };

  let contextLine: ConsoleLine | undefined;
  const time = (value: number) => new Date(value).toLocaleTimeString([], { hour12: false });
  const asText = (line: ConsoleLine) =>
    `${time(line.time)} [${sourceLabel(line.source)}] ${line.text}${line.count > 1 ? ` (×${line.count})` : ''}`;
  const copy = (text: string) => void navigator.clipboard?.writeText(text).catch(() => undefined);
  const contextItems = (): MenuEntry[] => {
    const line = contextLine;
    return [
      ...(line
        ? [
            {
              kind: 'item',
              id: 'copy',
              label: 'Copy line',
              onSelect: () => copy(asText(line)),
            } as const,
          ]
        : []),
      {
        kind: 'item',
        id: 'copy-all',
        label: 'Copy every shown line',
        disabled: !visible.length,
        onSelect: () => copy(visible.map(asText).join('\n')),
      },
      { kind: 'separator' },
      { kind: 'item', id: 'clear', label: 'Clear console', onSelect: clear },
    ];
  };
</script>

<div class="console">
  <div class="toolbar">
    <GroupChips bind:groups {stats} />
    <Menu items={menu}>
      {#snippet trigger({ props })}
        <IconButton {...props} icon="list-filter" label="Sources" pressed={hidden.length > 0} />
      {/snippet}
    </Menu>
    <div class="levels" role="group" aria-label="Levels">
      {#each LEVELS as level (level.id)}
        <IconButton
          icon={level.icon}
          label={level.label}
          pressed={levels[level.id]}
          onclick={() => (levels[level.id] = !levels[level.id])}
        />
      {/each}
    </div>
    <Input bind:value={query} placeholder="Search console" aria-label="Search console" />
    <IconButton icon="trash-2" label="Clear console" onclick={clear} />
  </div>

  <ContextMenu items={contextItems}>
    <div class="body">
      {#if !visible.length}
        <div class="empty">
          <EmptyState
            icon="square-terminal"
            title={lines.length ? 'No lines match the filters' : 'Nothing logged yet'}
            description={lines.length
              ? 'Show more groups, sources or levels, or change the search.'
              : 'Game, build and task output appears here.'}
          />
        </div>
      {/if}
      <div
        class="lines-list"
        bind:this={list}
        role="log"
        aria-label="Console"
        {onscroll}
        oncontextmenu={(event) => {
          const id = (event.target as HTMLElement).closest<HTMLElement>('[data-line]')?.dataset
            .line;
          contextLine = visible.find((line) => String(line.id) === id);
        }}
      >
        {#each visible as line (line.id)}
          <ConsoleLineRow {line} {segmentsOf} {locate} onopen={open} />
        {/each}
      </div>
      {#if !follow}
        <div class="latest">
          <Button
            size="sm"
            onclick={() => {
              follow = true;
              toBottom();
            }}>Jump to latest</Button
          >
        </div>
      {/if}
    </div>
  </ContextMenu>
</div>

<style>
  .console {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .toolbar {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    gap: var(--nf-space-2);
    align-items: center;
    padding: var(--nf-space-1) var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
  }
  .toolbar :global(input) {
    flex: 1;
    min-width: 120px;
  }
  .levels {
    display: flex;
    gap: var(--nf-space-1);
    align-items: center;
  }
  .body {
    position: relative;
    flex: 1;
    min-height: 0;
    height: 100%;
  }
  .lines-list {
    height: 100%;
    overflow: auto;
    padding: var(--nf-space-1) 0;
    font-family: var(--nf-font-code);
    font-size: var(--nf-font-size-sm);
  }
  .empty {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .latest {
    position: absolute;
    right: var(--nf-space-4);
    bottom: var(--nf-space-2);
  }
</style>
