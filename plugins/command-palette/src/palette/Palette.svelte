<script lang="ts">
  import { tick } from 'svelte';

  import {
    CodeServiceToken,
    type CodeSymbol,
    DocumentServiceToken,
    ProjectServiceToken,
    type ServiceAccessor,
  } from '@nanoforge-dev/editor-sdk';
  import {
    type EditorAction,
    KeybindingServiceToken,
    formatKeybinding,
  } from '@nanoforge-dev/editor-sdk/ui';

  import { highlight } from './fuzzy';
  import {
    PREFIXES,
    type Ranked,
    listedFiles,
    parseLine,
    parseQuery,
    rankActions,
    rankFiles,
    rankSymbols,
    symbolLabel,
  } from './palette-model';

  /** What the palette asks its owner to do once closed. */
  export type PaletteResult =
    | { kind: 'action'; action: EditorAction }
    | { kind: 'open'; path: string; line?: number; column?: number };

  interface Props {
    services: ServiceAccessor;
    /** What the box starts with: `>`, `:`, `@` or nothing (files). */
    prefix: string;
    /** Actions available where the palette was opened from. */
    actions: readonly EditorAction[];
    /** File of the active code editor, if any. */
    activeFile: string | undefined;
    recent: readonly string[];
    onclose: (result?: PaletteResult) => void;
  }

  interface Row {
    readonly id: string;
    readonly parts: { text: string; match: boolean }[];
    readonly detail?: string;
    readonly result: PaletteResult;
  }

  const given: Props = $props();
  // svelte-ignore state_referenced_locally
  const [services, prefix, actions, activeFile, recent, onclose] = [
    given.services,
    given.prefix,
    given.actions,
    given.activeFile,
    given.recent,
    given.onclose,
  ];
  const keybindings = services.tryGet(KeybindingServiceToken);
  const files = listedFiles(
    (services.tryGet(ProjectServiceToken)?.current.get()?.fs.entries ?? [])
      .filter((entry) => entry.kind === 'file')
      .map((entry) => entry.path),
  );
  const openFiles = services.tryGet(DocumentServiceToken)?.openUris ?? [];

  let input = $state(prefix);
  let active = $state(0);
  let box = $state<HTMLInputElement>();
  let list = $state<HTMLElement>();
  const query = $derived(parseQuery(input));

  let symbols = $state<readonly CodeSymbol[]>();
  let symbolsFailed = $state(false);
  $effect(() => {
    if (query.mode !== 'symbols' || symbols || symbolsFailed || !activeFile) return;
    const code = services.tryGet(CodeServiceToken);
    if (!code) {
      symbolsFailed = true;
      return;
    }
    code
      .symbols(activeFile)
      .then((found) => (symbols = found))
      .catch(() => (symbolsFailed = true));
  });

  const toRow = <T,>(
    entry: Ranked<T>,
    id: string,
    result: PaletteResult,
    detail?: string,
  ): Row => ({
    id,
    parts: highlight(entry.label, entry.match.ranges),
    ...(detail && { detail }),
    result,
  });

  const rows = $derived.by((): Row[] => {
    switch (query.mode) {
      case 'commands':
        return rankActions(actions, query.text, recent).map((entry) => {
          const key = keybindings?.keyFor(entry.item.command, entry.item.args);
          return toRow(
            entry,
            entry.item.id,
            { kind: 'action', action: entry.item },
            key ? formatKeybinding(key) : undefined,
          );
        });
      case 'files':
        return rankFiles(files, query.text, openFiles).map((entry) =>
          toRow(entry, entry.item, { kind: 'open', path: entry.item }),
        );
      case 'symbols':
        if (!activeFile || !symbols) return [];
        return rankSymbols(symbols, query.text).map((entry) =>
          toRow(
            entry,
            `${symbolLabel(entry.item)}:${entry.item.line}:${entry.item.column}`,
            {
              kind: 'open',
              path: activeFile,
              line: entry.item.line,
              column: entry.item.column,
            },
            `${entry.item.kind} · line ${entry.item.line}`,
          ),
        );
      case 'line': {
        const position = parseLine(query.text);
        if (!activeFile || !position) return [];
        return [
          {
            id: 'line',
            parts: [
              {
                text: `Go to line ${position.line}${position.column > 1 ? `, column ${position.column}` : ''}`,
                match: false,
              },
            ],
            detail: activeFile,
            result: { kind: 'open', path: activeFile, ...position },
          },
        ];
      }
    }
  });

  /** What to say when there is no row. */
  const empty = $derived.by(() => {
    switch (query.mode) {
      case 'commands':
        return 'No command matches';
      case 'files':
        return files.length ? 'No file matches' : 'This project has no files';
      case 'symbols':
        if (!activeFile) return 'Open a file in the code editor to list its symbols';
        if (symbolsFailed) return 'The symbols of this file could not be read';
        return symbols ? 'No symbol matches' : 'Reading symbols…';
      case 'line':
        if (!activeFile) return 'Open a file in the code editor to go to a line';
        return 'Type a line number, and a column if you want: 12 or 12:4';
    }
  });

  $effect(() => {
    void input;
    active = 0;
  });
  $effect(() => {
    box?.focus();
    box?.setSelectionRange(input.length, input.length);
  });

  let closed = false;
  const finish = (result?: PaletteResult) => {
    closed = true;
    onclose(result);
  };

  const move = async (delta: number) => {
    if (!rows.length) return;
    active = (active + delta + rows.length) % rows.length;
    await tick();
    list?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  };

  const onkeydown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') void move(1);
    else if (event.key === 'ArrowUp') void move(-1);
    else if (event.key === 'Enter') {
      const row = rows[active];
      if (row) finish(row.result);
    } else if (event.key === 'Escape') finish();
    else if (event.key !== 'Tab') return;
    event.preventDefault();
    event.stopPropagation();
  };
</script>

<div class="scrim" role="presentation" onpointerdown={() => finish()}>
  <div
    class="palette"
    role="dialog"
    aria-label="Command palette"
    aria-modal="true"
    tabindex="-1"
    onpointerdown={(event) => event.stopPropagation()}
  >
    <input
      bind:this={box}
      bind:value={input}
      type="text"
      role="combobox"
      aria-label="Command palette"
      aria-expanded="true"
      aria-controls="nf-palette-results"
      aria-activedescendant={rows[active] ? `nf-palette-row-${active}` : undefined}
      aria-autocomplete="list"
      autocomplete="off"
      spellcheck="false"
      placeholder="Search files, or type > for commands"
      {onkeydown}
      onblur={() => !closed && box?.focus()}
    />
    <div
      class="results"
      id="nf-palette-results"
      role="listbox"
      aria-label="Results"
      bind:this={list}
    >
      {#each rows as row, index (row.id)}
        <div
          class="row"
          id={`nf-palette-row-${index}`}
          role="option"
          tabindex="-1"
          aria-selected={index === active}
          onpointermove={() => (active = index)}
          onclick={() => finish(row.result)}
          onkeydown={() => undefined}
        >
          <span class="label">
            {#each row.parts as part, at (at)}{#if part.match}<mark>{part.text}</mark
                >{:else}{part.text}{/if}{/each}
          </span>
          {#if row.detail}<span class="detail">{row.detail}</span>{/if}
        </div>
      {:else}
        <p class="empty" role="status">{empty}</p>
      {/each}
    </div>
    <p class="hint">
      <kbd>{PREFIXES.commands}</kbd> commands
      <kbd>{PREFIXES.line}</kbd> go to line
      <kbd>{PREFIXES.symbols}</kbd> symbols
      <span>no prefix: files</span>
    </p>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: var(--nf-z-dialog);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 12vh;
  }
  .palette {
    display: flex;
    flex-direction: column;
    width: min(640px, 92vw);
    max-height: 60vh;
    border: 1px solid var(--nf-color-border-strong);
    border-radius: var(--nf-radius-float);
    background: var(--nf-color-raised);
    box-shadow: var(--nf-shadow-float);
    overflow: hidden;
  }
  input {
    flex: none;
    height: 40px;
    padding: 0 var(--nf-space-3);
    border: 0;
    border-bottom: 1px solid var(--nf-color-border);
    background: transparent;
    color: var(--nf-color-text);
    font: inherit;
    outline: none;
  }
  .results {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: var(--nf-space-1) 0;
  }
  .row {
    display: flex;
    gap: var(--nf-space-3);
    align-items: center;
    justify-content: space-between;
    padding: var(--nf-space-1) var(--nf-space-3);
    cursor: pointer;
  }
  .row[aria-selected='true'] {
    background: var(--nf-color-selection);
    color: var(--nf-color-selection-text);
  }
  .label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  mark {
    background: none;
    color: var(--nf-color-accent);
    font-weight: 600;
  }
  .row[aria-selected='true'] mark {
    color: inherit;
    text-decoration: underline;
  }
  .detail {
    flex: none;
    max-width: 50%;
    overflow: hidden;
    color: var(--nf-color-text-faint);
    font-size: var(--nf-font-size-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row[aria-selected='true'] .detail {
    color: inherit;
  }
  .empty {
    margin: 0;
    padding: var(--nf-space-3);
    color: var(--nf-color-text-muted);
  }
  .hint {
    display: flex;
    flex: none;
    gap: var(--nf-space-3);
    align-items: center;
    margin: 0;
    padding: var(--nf-space-1) var(--nf-space-3);
    border-top: 1px solid var(--nf-color-border);
    color: var(--nf-color-text-faint);
    font-size: var(--nf-font-size-sm);
  }
  kbd {
    padding: 0 4px;
    border: 1px solid var(--nf-color-border);
    border-radius: 3px;
    font-family: var(--nf-font-code);
  }
</style>
