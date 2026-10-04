<script lang="ts">
  import type { editor as MonacoEditor } from 'monaco-editor';
  import { onDestroy, onMount, untrack } from 'svelte';

  import { basename } from '@nanoforge-dev/editor-sdk';
  import { Button, Dialog, EmptyState, Icon, IconButton } from '@nanoforge-dev/editor-sdk/ui';

  import type { EditorDocument } from '../../document/editor-document';
  import type { CodeEditorService } from '../../service/code-editor-service';
  import type { EditorGroup } from '../../service/code-editor.type';
  import { SETTING } from '../../service/code-editor-settings.const';
  import type { Monaco } from '../../monaco/monaco';

  interface Props {
    service: CodeEditorService;
    monaco: Monaco;
    index: number;
    group: EditorGroup;
    focused: boolean;
  }

  const { service, monaco, index, group, focused }: Props = $props();

  let host = $state<HTMLElement>();
  let groupElement = $state<HTMLElement>();
  let diffHost = $state<HTMLElement>();
  let editor: MonacoEditor.IStandaloneCodeEditor | undefined;
  let diff: MonacoEditor.IStandaloneDiffEditor | undefined;
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const viewStates = new Map<string, MonacoEditor.ICodeEditorViewState | null>();
  let shown: string | undefined;
  let comparing = $state(false);
  /** Tab waiting for a decision before closing (unsaved changes). */
  let closing = $state<string>();
  /** Bumped when a document's dirty or conflict state changes (tab markers, banner). */
  let revision = $state(0);

  const documentOf = (path: string | undefined): EditorDocument | undefined => {
    void revision;
    void loaded;
    return path ? service.document(path) : undefined;
  };
  const active = $derived(documentOf(group.active));
  const conflict = $derived.by(() => {
    void revision;
    return active?.conflict.get();
  });
  const stateOf = (path: string) => {
    void revision;
    void loaded;
    const document = service.document(path);
    return {
      readOnly: document?.readOnly ?? false,
      dirty: document?.dirty.get() ?? false,
      conflict: !!document?.conflict.get(),
    };
  };

  /** The text the active file is compared with (a previous version), if any. */
  const comparisons = service.comparisons;
  const comparison = $derived(active ? $comparisons.get(active.uri) : undefined);

  /** Bumped when documents load or are released. */
  let loaded = $state(0);
  $effect(() => {
    const subscription = service.onDidChangeDocuments(() => loaded++);
    return () => subscription.dispose();
  });

  $effect(() => {
    void loaded;
    const unsubscribers = group.tabs.flatMap((path) => {
      const document = service.document(path);
      if (!document) return [];
      const bump = () => untrack(() => revision++);
      return [document.dirty.subscribe(bump), document.conflict.subscribe(bump)];
    });
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  });

  onMount(() => {
    if (!host) return;
    editor = monaco.editor.create(host, {
      model: null,
      automaticLayout: true,
      theme: 'nanoforge',
      fontFamily: 'var(--nf-font-code)',
      fontSize: service.setting<number>(SETTING.fontSize),
      minimap: { enabled: service.setting<boolean>(SETTING.minimap) },
      wordWrap: service.setting<boolean>(SETTING.wordWrap) ? 'on' : 'off',
      fixedOverflowWidgets: true,
      scrollBeyondLastLine: false,
      tabSize: 2,
    });
    editor.onDidFocusEditorWidget(() => service.focusGroup(index));
    editor.onDidBlurEditorWidget(() => service.focusLost());
    const settings = [SETTING.fontSize, SETTING.minimap, SETTING.wordWrap].map((key) =>
      service.observeSetting(key).subscribe(() =>
        editor?.updateOptions({
          fontSize: service.setting<number>(SETTING.fontSize),
          minimap: { enabled: service.setting<boolean>(SETTING.minimap) },
          wordWrap: service.setting<boolean>(SETTING.wordWrap) ? 'on' : 'off',
        }),
      ),
    );
    const reveal = service.onReveal((target) => {
      if (target.group === index && target.path === shown) showPending();
    });
    return () => {
      settings.forEach((unsubscribe) => unsubscribe());
      reveal.dispose();
    };
  });

  /** Moves the cursor to a position requested by `open` (go to definition, links). */
  const showPending = () => {
    const target = editor && shown ? service.takeReveal(index, shown) : undefined;
    if (!target || !editor) return;
    const position = { lineNumber: target.line, column: target.column };
    editor.setPosition(position);
    editor.revealPositionInCenterIfOutsideViewport(position);
    editor.focus();
  };

  /**
   * Whether the editor may take focus when it shows a tab: not while the user is elsewhere (a
   * menu opened while the tabs are restored after a reload, for example).
   */
  const focusIsFree = () => {
    const current = window.document.activeElement;
    return !current || current === window.document.body || !!groupElement?.contains(current);
  };

  onDestroy(() => {
    diff?.dispose();
    editor?.dispose();
  });

  $effect(() => {
    const document = active;
    if (!editor) return;
    if (shown && shown !== document?.uri) viewStates.set(shown, editor.saveViewState());
    if (!document) {
      editor.setModel(null);
      shown = undefined;
      return;
    }
    if (shown === document.uri && editor.getModel() === document.model) return;
    editor.setModel(document.model);
    editor.updateOptions({ readOnly: document.readOnly });
    const state = viewStates.get(document.uri);
    if (state) editor.restoreViewState(state);
    shown = document.uri;
    if (focused && focusIsFree()) editor.focus();
    showPending();
  });

  const comparedText = $derived(
    comparing && conflict ? (conflict.diskText ?? '') : comparison?.text,
  );
  $effect(() => {
    if (comparedText === undefined || !diffHost || !active) return;
    const original = monaco.editor.createModel(comparedText, active.model.getLanguageId());
    diff = monaco.editor.createDiffEditor(diffHost, {
      automaticLayout: true,
      theme: 'nanoforge',
      renderSideBySide: true,
      fixedOverflowWidgets: true,
    });
    diff.setModel({ original, modified: active.model });
    return () => {
      diff?.dispose();
      diff = undefined;
      original.dispose();
    };
  });
  $effect(() => {
    if (!conflict) comparing = false;
  });

  const select = (path: string) => {
    if (group.active !== path) service.focusLost();
    service.activate(index, path);
  };

  const requestClose = (path: string) => {
    if (service.document(path)?.dirty.get()) closing = path;
    else service.close(index, path);
  };

  const closeAfter = async (decision: 'save' | 'discard') => {
    const path = closing;
    closing = undefined;
    if (!path) return;
    if (decision === 'save') await service.save(path);
    else await service.revert(path);
    if (!service.document(path)?.dirty.get()) service.close(index, path);
  };
</script>

<section
  bind:this={groupElement}
  class="group"
  class:focused
  aria-label={`Editor group ${index + 1}`}
  onfocusin={() => service.focusGroup(index)}
>
  <div class="tabs" role="tablist" aria-label="Open files">
    {#each group.tabs as path (path)}
      {@const state = stateOf(path)}
      <div
        class="tab"
        class:active={path === group.active}
        role="tab"
        tabindex={path === group.active ? 0 : -1}
        aria-selected={path === group.active}
        title={path}
        onclick={() => select(path)}
        onauxclick={(event) => event.button === 1 && requestClose(path)}
        onkeydown={(event) => event.key === 'Enter' && select(path)}
      >
        {#if state.readOnly}<Icon name="lock" size={12} />{/if}
        <span class="name">{basename(path)}</span>
        {#if state.conflict}
          <span class="marker conflict" title="Changed on disk"
            ><Icon name="triangle-alert" size={12} /></span
          >
        {:else if state.dirty}
          <span class="marker dirty" aria-label="Unsaved changes">●</span>
        {/if}
        <IconButton
          icon="x"
          label={`Close ${basename(path)}`}
          size={12}
          onclick={(event) => {
            event.stopPropagation();
            requestClose(path);
          }}
        />
      </div>
    {/each}
  </div>

  {#if conflict && active}
    <div class="banner" role="alert">
      <Icon name="triangle-alert" size={16} />
      <p>
        {conflict.diskText === null
          ? `${basename(active.uri)} was deleted on disk while you had unsaved changes.`
          : `${basename(active.uri)} changed on disk while you had unsaved changes.`}
      </p>
      {#if conflict.diskText !== null}
        <Button size="sm" onclick={() => (comparing = !comparing)}>
          {comparing ? 'Close comparison' : 'Compare'}
        </Button>
      {/if}
      <Button size="sm" variant="primary" onclick={() => active.keepMine()}>Keep mine</Button>
      {#if conflict.diskText !== null}
        <Button size="sm" onclick={() => active.loadDisk()}>Load disk version</Button>
      {/if}
    </div>
  {/if}

  {#if comparison && active && !(comparing && conflict)}
    <div class="banner" role="status">
      <Icon name="file-code" size={16} />
      <p>{basename(active.uri)} compared with: {comparison.label} (left).</p>
      <Button size="sm" onclick={() => service.closeComparison(active.uri)}>Close comparison</Button
      >
    </div>
  {/if}

  <div class="body">
    <div class="editor" bind:this={host} hidden={!active || comparedText !== undefined}></div>
    {#if comparedText !== undefined}
      <div
        class="editor"
        bind:this={diffHost}
        aria-label={comparing && conflict
          ? 'Disk version and your version'
          : `${comparison?.label ?? 'Other version'} and the file`}
      ></div>
    {/if}
    {#if !active}
      <EmptyState
        icon="file-code"
        title="No file open"
        description="Open a file from the Files panel, or with Go to definition."
      />
    {/if}
  </div>
</section>

<Dialog
  open={closing !== undefined}
  title={`Save changes to ${closing ? basename(closing) : ''}?`}
  description="Your changes will be lost if you don't save them."
  onclose={() => (closing = undefined)}
>
  {#snippet footer()}
    <Button onclick={() => (closing = undefined)}>Cancel</Button>
    <Button variant="danger" onclick={() => closeAfter('discard')}>Don't save</Button>
    <Button variant="primary" onclick={() => closeAfter('save')}>Save</Button>
  {/snippet}
</Dialog>

<style>
  .group {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    background: var(--nf-color-surface);
  }
  .group + :global(.group) {
    border-left: 1px solid var(--nf-color-border);
  }
  .tabs {
    display: flex;
    flex: none;
    overflow-x: auto;
    border-bottom: 1px solid var(--nf-color-border);
    background: var(--nf-color-bg);
  }
  .tab {
    display: flex;
    gap: var(--nf-space-1);
    align-items: center;
    padding: 0 var(--nf-space-1) 0 var(--nf-space-3);
    height: 30px;
    border-right: 1px solid var(--nf-color-border);
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
    white-space: nowrap;
    cursor: pointer;
  }
  .tab.active {
    background: var(--nf-color-surface);
    color: var(--nf-color-text);
  }
  .group.focused .tab.active {
    box-shadow: inset 0 2px 0 var(--nf-color-accent);
  }
  .marker.dirty {
    color: var(--nf-color-text);
    font-size: 10px;
  }
  .marker.conflict {
    display: inline-flex;
    color: var(--nf-color-warning);
  }
  .banner {
    display: flex;
    flex: none;
    gap: var(--nf-space-2);
    align-items: center;
    padding: var(--nf-space-2) var(--nf-space-3);
    border-bottom: 1px solid var(--nf-color-warning);
    background: var(--nf-color-raised);
    font-size: var(--nf-font-size-sm);
  }
  .banner > :global(svg) {
    color: var(--nf-color-warning);
  }
  .banner p {
    flex: 1;
    margin: 0;
  }
  .body {
    position: relative;
    flex: 1;
    min-height: 0;
  }
  .editor {
    position: absolute;
    inset: 0;
  }
  .editor[hidden] {
    display: none;
  }
</style>
