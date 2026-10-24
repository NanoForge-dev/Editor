<script lang="ts">
  import { CatalogServiceToken } from '@nanoforge-dev/editor-code';
  import { ProjectServiceToken, librariesOf, runnableApps } from '@nanoforge-dev/editor-project';
  import type { AppModel } from '@nanoforge-dev/editor-protocol';
  import {
    Button,
    Checkbox,
    Dialog,
    EmptyState,
    IconButton,
    Menu,
    type MenuEntry,
    type WidgetInstance,
  } from '@nanoforge-dev/editor-ui';

  import { PROJECT_HISTORY_CONTEXT, WorkspaceActionsToken } from '../workspace/workspace-actions';
  import AddAppDialog from './AddAppDialog.svelte';
  import AddLibraryDialog from './AddLibraryDialog.svelte';

  const { instance }: { instance: WidgetInstance } = $props();
  const current = $derived(instance.services.get(ProjectServiceToken).current);
  const model = $derived($current?.model);
  const actions = $derived(instance.services.tryGet(WorkspaceActionsToken));
  const request = $derived(actions?.request);
  const hasSteps = $derived(actions?.hasSteps);
  $effect(() => instance.setHistoryContext($hasSteps ? PROJECT_HISTORY_CONTEXT : undefined));
  const catalog = $derived(instance.services.tryGet(CatalogServiceToken)?.state);

  const apps = $derived($model ? runnableApps($model) : []);
  const libraries = $derived($model ? librariesOf($model) : []);
  /** How many items (components, systems) the catalog found in a library. */
  const itemsOf = (library: AppModel) =>
    ($catalog?.items ?? []).filter(
      (item) => item.source.kind === 'lib' && item.source.name === library.name,
    ).length;
  const exists = (path: string) => $current?.fs.entry(path) !== undefined;

  const menu = (app: AppModel): MenuEntry[] => [
    { kind: 'item', id: 'rename', label: 'Rename…', onSelect: () => void actions?.rename(app) },
    {
      kind: 'item',
      id: 'remove',
      label: 'Remove…',
      disabled: app.type !== 'lib' && apps.length <= 1,
      onSelect: () => actions?.ask({ kind: 'remove', app }),
    },
    ...(actions?.canReveal
      ? [
          { kind: 'separator' as const },
          {
            kind: 'item' as const,
            id: 'reveal',
            label: 'Reveal in file manager',
            onSelect: () => actions.reveal(app),
          },
        ]
      : []),
  ];
  const addMenu: MenuEntry[] = [
    {
      kind: 'item',
      id: 'client',
      label: 'Add client app…',
      onSelect: () => actions?.ask({ kind: 'app', type: 'client' }),
    },
    {
      kind: 'item',
      id: 'server',
      label: 'Add server app…',
      onSelect: () => actions?.ask({ kind: 'app', type: 'server' }),
    },
  ];
</script>

{#if $model}
  <div class="overview" tabindex="-1">
    <h1>{$model.name}</h1>
    <p class="location">{$model.location}</p>

    {#if $model.diagnostics.length}
      <section aria-label="Problems">
        {#each $model.diagnostics as diagnostic, index (index)}
          <p class="diagnostic {diagnostic.severity}">
            <code>{diagnostic.path || '.'}</code>
            {diagnostic.message}
          </p>
        {/each}
      </section>
    {/if}

    <header class="heading">
      <h2>Apps</h2>
      {#if actions}
        <Menu items={addMenu} align="end">
          {#snippet trigger({ props })}
            <Button {...props} size="sm" icon="plus">Add app</Button>
          {/snippet}
        </Menu>
      {/if}
    </header>
    <section class="apps" aria-label="Apps">
      {#each apps as app (app.id)}
        <article class="app" aria-label={app.name}>
          <h3>
            <span class="name">{app.name}</span>
            <span class="type">{app.type}</span>
            {#if actions}
              <Menu items={menu(app)} align="end">
                {#snippet trigger({ props })}
                  <IconButton {...props} icon="ellipsis" label={`Actions of ${app.name}`} />
                {/snippet}
              </Menu>
            {/if}
          </h3>
          <p class="path">{app.root || '.'}</p>
          <ul class="libs" aria-label="Engine libraries">
            {#each Object.entries(app.engineLibs) as [name, version] (name)}
              <li>
                {name.replace('@nanoforge-dev/', '')}
                {#if /^\d/.test(version)}<span>{version}</span>{/if}
              </li>
            {:else}
              <li class="none">No engine library</li>
            {/each}
          </ul>
          {#if app.libraries.length}
            <p class="uses">Uses {app.libraries.join(', ')}</p>
          {/if}
        </article>
      {/each}
    </section>

    <header class="heading">
      <h2>Shared libraries</h2>
      {#if actions}
        <Button size="sm" icon="plus" onclick={() => actions.ask({ kind: 'library' })}
          >Add shared library</Button
        >
      {/if}
    </header>
    {#if libraries.length}
      <section class="apps" aria-label="Shared libraries">
        {#each libraries as library (library.id)}
          {@const count = itemsOf(library)}
          <article class="app" aria-label={library.name}>
            <h3>
              <span class="name">{library.name}</span>
              {#if actions}
                <Menu items={menu(library)} align="end">
                  {#snippet trigger({ props })}
                    <IconButton {...props} icon="ellipsis" label={`Actions of ${library.name}`} />
                  {/snippet}
                </Menu>
              {/if}
            </h3>
            <p class="path">
              {library.root} · {count}
              {count === 1 ? 'component or system' : 'components and systems'}
            </p>
            <fieldset>
              <legend>Used by</legend>
              {#each apps as app (app.id)}
                <Checkbox
                  label={app.name}
                  checked={app.libraries.includes(library.name)}
                  disabled={!actions}
                  onchange={(checked) => void actions?.setUse(app, library, checked)}
                />
              {/each}
            </fieldset>
            {#if library.unclaimed}
              <p class="note">
                No app lists it in the libs of its nanoforge.config yet, so every app gets it.
                Untick one to choose.
              </p>
            {/if}
          </article>
        {/each}
      </section>
    {:else}
      <p class="empty">
        A shared library holds the components and systems that several apps use: a position the
        client draws and the server computes, for example.
      </p>
    {/if}
  </div>
  {#if actions && $request?.kind === 'library'}
    <AddLibraryDialog
      project={$model.name}
      {apps}
      {exists}
      oncreate={(library) => void actions.addLibrary(library)}
      onclose={() => actions.ask(undefined)}
    />
  {:else if actions && $request?.kind === 'app'}
    <AddAppDialog
      type={$request.type}
      project={$model.name}
      {apps}
      {exists}
      oncreate={(app) => void actions.addApp(app)}
      onclose={() => actions.ask(undefined)}
    />
  {:else if actions && $request?.kind === 'remove'}
    {@const target = $request.app}
    <Dialog
      open
      title={`Remove ${target.name}?`}
      width="min(440px, 92vw)"
      onclose={() => actions.ask(undefined)}
    >
      <p class="confirm">
        The folder <code>{target.root}</code> goes to the editor's trash. Undo (Ctrl+Z on this screen)
        brings it back.
      </p>
      {#snippet footer()}
        <Button onclick={() => actions.ask(undefined)}>Cancel</Button>
        <Button
          variant="danger"
          onclick={() => {
            void actions.remove(target);
            actions.ask(undefined);
          }}>Remove</Button
        >
      {/snippet}
    </Dialog>
  {/if}
{:else}
  <EmptyState icon="folder-open" title="No project open" />
{/if}

<style>
  .overview {
    outline: none;
    max-width: 880px;
    padding: var(--nf-space-5) var(--nf-space-5);
  }
  h1 {
    margin: 0;
    font-size: var(--nf-font-size-xl);
    font-weight: 600;
  }
  .location {
    margin: var(--nf-space-1) 0 var(--nf-space-4);
    color: var(--nf-color-text-muted);
  }
  .diagnostic {
    margin: 0 0 var(--nf-space-1);
  }
  .diagnostic.error {
    color: var(--nf-color-danger);
  }
  .diagnostic.warning {
    color: var(--nf-color-warning);
  }
  .apps {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--nf-space-3);
  }
  .app {
    padding: var(--nf-space-3);
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-float);
    background: var(--nf-color-raised);
  }
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: var(--nf-space-4) 0 var(--nf-space-2);
  }
  h2 {
    margin: 0;
    font-size: var(--nf-font-size-lg);
    font-weight: 600;
  }
  h3 {
    display: flex;
    gap: var(--nf-space-2);
    align-items: center;
    margin: 0;
    font-size: var(--nf-font-size-lg);
    font-weight: 600;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  fieldset {
    display: grid;
    gap: var(--nf-space-1);
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    padding: 0 0 var(--nf-space-1);
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .uses,
  .note,
  .empty {
    margin: var(--nf-space-2) 0 0;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .empty {
    max-width: 60ch;
    margin: 0;
  }
  .confirm {
    margin: 0;
  }
  .type {
    color: var(--nf-color-accent-text);
    font-size: var(--nf-font-size-sm);
    font-weight: 500;
  }
  .path {
    margin: 2px 0 var(--nf-space-2);
    color: var(--nf-color-text-faint);
    font-family: var(--nf-font-code);
    font-size: var(--nf-font-size-sm);
  }
  .libs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nf-space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .libs li {
    padding: 1px 6px;
    border-radius: 2px;
    background: var(--nf-color-sunken);
    font-size: var(--nf-font-size-sm);
  }
  .libs span,
  .none {
    color: var(--nf-color-text-faint);
  }
</style>
