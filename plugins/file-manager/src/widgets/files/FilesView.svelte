<script lang="ts">
  import { untrack } from 'svelte';

  import {
    EditorServices,
    type FileEntry,
    SettingsServiceToken,
    basename,
    dirname,
  } from '@nanoforge-dev/editor-sdk';
  import {
    FILE_DECORATIONS,
    type FileDecoration,
    Button,
    ContextMenu,
    Dialog,
    EmptyState,
    IconButton,
    Input,
    Menu,
    Tree,
    type WidgetInstance,
  } from '@nanoforge-dev/editor-sdk/ui';

  import GridView from './GridView.svelte';
  import {
    type FileTreeContext,
    buildTree,
    gridOrder,
    openFolders,
    searchTree,
    treeNode,
    visibleEntries,
  } from './file-tree';
  import { FileFilter, PACKAGES } from '../../filter/file-filter';
  import { fileMenu, newEntries } from '../../menu/file-menu';
  import { current } from '../../session/file-manager-session';
  import { SETTING } from '../../settings/file-manager-settings.const';

  const { instance }: { instance: WidgetInstance } = $props();
  // svelte-ignore state_referenced_locally
  const { services } = instance;
  const settings = services.get(SettingsServiceToken);
  const extensions = services.get(EditorServices.Extensions);
  const contextKeys = services.get(EditorServices.ContextKeys);
  const commands = services.get(EditorServices.Commands);

  const exclude = settings.observe<string[]>(SETTING.exclude);
  const showHidden = settings.observe<boolean>(SETTING.showHidden);
  const view = settings.observe<'tree' | 'split'>(SETTING.view);
  const gridSize = settings.observe<number>(SETTING.gridSize);

  const service = $derived($current);
  const selection = $derived(service?.selection);
  const folder = $derived(service?.folder);
  const pendingDelete = $derived(service?.pendingDelete);

  let revision = $state(0);
  let query = $state('');
  // svelte-ignore state_referenced_locally
  let expanded = $state(new Set<string>(instance.getState<string[]>() ?? []));
  let selected = $state(new Set<string>());
  let menuTarget = $state<readonly string[]>([]);
  let dropFolder = $state<string>();

  $effect(() => {
    const project = service?.project;
    if (!project) return;
    const subscription = project.fs.onDidChange(() => revision++);
    return () => subscription.dispose();
  });
  $effect(() => instance.setState([...expanded]));

  const decorators = extensions.observe(FILE_DECORATIONS);
  $effect(() => {
    const unsubscribers = $decorators.map((provider) =>
      provider.value.changes.subscribe(() => untrack(() => revision++)),
    );
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  });
  const decorate = (entry: FileEntry): FileDecoration | undefined => {
    void revision;
    for (const provider of $decorators) {
      const decoration = provider.value.decorate(entry.path, entry.kind);
      if (decoration) return decoration;
    }
    return undefined;
  };
  $effect(() => {
    const paths = [...selected];
    untrack(() => service?.select(paths));
  });
  $effect(() => {
    const paths = $selection ?? [];
    untrack(() => {
      if (paths.length !== selected.size || paths.some((path) => !selected.has(path))) {
        selected = new Set(paths);
      }
    });
  });

  const filter = $derived(new FileFilter($exclude ?? []));
  const tree = $derived<FileTreeContext | undefined>(
    service && { service, filter, showHidden: !!$showHidden, expanded, decorate },
  );

  const nodes = $derived.by(() => {
    void revision;
    if (!tree) return [];
    return query.trim() ? searchTree(tree, '', query.trim()) : buildTree(tree, '');
  });

  const packages = $derived.by(() => {
    void revision;
    const entry = service?.project.fs.entry(PACKAGES);
    return entry && tree ? [treeNode(tree, entry, buildTree(tree, PACKAGES))] : [];
  });

  const searchExpanded = $derived(query.trim() ? openFolders(nodes) : undefined);

  const gridEntries = $derived.by(() => {
    void revision;
    return tree ? gridOrder(visibleEntries(tree, $folder ?? '')) : [];
  });

  let treeHost = $state<HTMLElement>();
  /** After a drop, keyboard focus returns to the tree: Ctrl+Z undoes the move right away. */
  const refocus = () => treeHost?.querySelector<HTMLElement>('[role="tree"]')?.focus();

  const move = (paths: string[], target: string, position: 'before' | 'inside' | 'after') => {
    const destination = position === 'inside' ? target : dirname(target);
    refocus();
    void service?.move(paths, destination);
  };

  const menu = () =>
    service
      ? fileMenu(service, menuTarget, contextKeys, extensions, (id, ...args) =>
          commands.execute(id, ...args),
        )
      : [];

  /** Files dropped from the computer onto a row (its folder) or the tree background (root). */
  const osDrop = (event: DragEvent) => {
    const files = [...(event.dataTransfer?.files ?? [])];
    if (!files.length || !service) return;
    event.preventDefault();
    dropFolder = undefined;
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-id]');
    refocus();
    void service.importFiles(row ? service.targetFolder(row.dataset.id) : '', files);
  };
  const osDragOver = (event: DragEvent) => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-id]');
    dropFolder = row ? service?.targetFolder(row.dataset.id) : '';
  };

  const toggleSetting = (key: string, value: unknown) =>
    void settings.set(key, value, settings.hasStore('machine') ? 'machine' : 'account');
</script>

{#if service}
  <div class="files">
    <div class="toolbar" role="toolbar" aria-label="Files">
      <Input bind:value={query} placeholder="Search files" aria-label="Search files" />
      <Menu items={newEntries(service, service.targetFolder())} align="end">
        {#snippet trigger({ props })}
          <IconButton {...props} icon="plus" label="New" />
        {/snippet}
      </Menu>
      <IconButton
        icon="upload"
        label="Import files"
        onclick={() => service.pickFiles(service.targetFolder())}
      />
      <IconButton
        icon={$showHidden ? 'eye' : 'eye-off'}
        label={$showHidden ? 'Hide hidden files' : 'Show hidden files'}
        pressed={$showHidden}
        onclick={() => toggleSetting(SETTING.showHidden, !$showHidden)}
      />
      <IconButton
        icon="layout-grid"
        label={$view === 'split' ? 'Hide the grid' : 'Show the grid'}
        pressed={$view === 'split'}
        onclick={() => toggleSetting(SETTING.view, $view === 'split' ? 'tree' : 'split')}
      />
    </div>

    <ContextMenu items={menu}>
      <div class="panes" class:split={$view === 'split'}>
        <div
          bind:this={treeHost}
          class="tree"
          class:drop={dropFolder === ''}
          role="presentation"
          oncontextmenu={(event) => {
            if (!(event.target as HTMLElement).closest('[data-id]')) {
              menuTarget = [];
              selected = new Set();
            }
          }}
          ondragover={osDragOver}
          ondragleave={() => (dropFolder = undefined)}
          ondrop={osDrop}
        >
          {#if nodes.length || query}
            {#if searchExpanded}
              <Tree
                label="Project files"
                {nodes}
                expanded={searchExpanded}
                bind:selected
                onactivate={(path) => void service.open(path)}
                onrename={(path, name) => service.renameTo(path, name)}
                ondrop={move}
                oncontextmenu={() => (menuTarget = [...selected])}
              />
            {:else}
              <Tree
                label="Project files"
                {nodes}
                bind:expanded
                bind:selected
                onactivate={(path) => void service.open(path)}
                onrename={(path, name) => service.renameTo(path, name)}
                ondrop={move}
                oncontextmenu={() => (menuTarget = [...selected])}
              />
            {/if}
          {:else}
            <EmptyState icon="folder-open" title="No files" description="Create or import files." />
          {/if}
          {#if packages.length && !query}
            <section class="packages" aria-label="Packages">
              <h3>Packages <span>read-only</span></h3>
              <Tree
                label="Installed packages"
                nodes={packages}
                bind:expanded
                bind:selected
                onactivate={(path) => void service.open(path)}
                oncontextmenu={() => (menuTarget = [...selected])}
              />
            </section>
          {/if}
        </div>
        {#if $view === 'split'}
          <div class="grid-pane">
            <p class="location">{$folder || 'Project'}</p>
            <GridView
              {service}
              folder={$folder ?? ''}
              entries={gridEntries}
              selection={$selection ?? []}
              size={$gridSize ?? 96}
              {decorate}
              oncontext={(path) => (menuTarget = path ? [...($selection ?? [path])] : [])}
              onimport={(target, files) => void service.importFiles(target, files)}
            />
          </div>
        {/if}
      </div>
    </ContextMenu>
  </div>

  <Dialog
    open={!!$pendingDelete}
    title={$pendingDelete?.length === 1
      ? `Delete ${basename($pendingDelete[0] ?? '')} and everything in it?`
      : `Delete ${$pendingDelete?.length ?? 0} items?`}
    description="They go to the project trash. Undo (Ctrl+Z) brings them back."
    onclose={() => void service.confirmDelete(false)}
  >
    {#snippet footer()}
      <Button onclick={() => void service.confirmDelete(false)}>Cancel</Button>
      <Button variant="danger" onclick={() => void service.confirmDelete(true)}>Delete</Button>
    {/snippet}
  </Dialog>
{:else}
  <EmptyState icon="folder-tree" title="No project open" />
{/if}

<style>
  .files {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .toolbar {
    display: flex;
    flex: none;
    gap: var(--nf-space-1);
    align-items: center;
    padding: var(--nf-space-1) var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
  }
  .toolbar :global(input) {
    flex: 1;
    min-width: 0;
  }
  .files :global(.nf-context-area) {
    display: block;
    flex: 1;
    min-height: 0;
  }
  .panes {
    display: grid;
    grid-template-rows: 1fr;
    height: 100%;
    min-height: 0;
  }
  .panes.split {
    grid-template-rows: minmax(120px, 1fr) minmax(120px, 1fr);
  }
  .tree {
    min-height: 0;
    overflow: auto;
  }
  .tree.drop {
    box-shadow: inset 0 0 0 2px var(--nf-color-accent);
  }
  .grid-pane {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-top: 1px solid var(--nf-color-border);
  }
  .location {
    flex: none;
    margin: 0;
    padding: var(--nf-space-1) var(--nf-space-3);
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .packages {
    border-top: 1px solid var(--nf-color-border);
  }
  .packages h3 {
    margin: 0;
    padding: var(--nf-space-2) var(--nf-space-3) var(--nf-space-1);
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
    font-weight: 600;
  }
  .packages h3 span {
    margin-left: var(--nf-space-1);
    color: var(--nf-color-text-faint);
    font-weight: 400;
  }
</style>
