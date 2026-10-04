<script lang="ts">
  import {
    AccountSyncToken,
    EditorServices,
    PluginHostToken,
    ObservableValue,
    RpcClientToken,
    SessionContract,
    type ServiceAccessor,
    SettingsRegistryToken,
    SettingsServiceToken,
  } from '@nanoforge-dev/editor-sdk';
  import {
    Button,
    Dialog,
    EmptyState,
    Input,
    Menu,
    type MenuEntry,
    NotificationServiceToken,
    SETTINGS_PAGES,
    ThemeServiceToken,
    Tree,
  } from '@nanoforge-dev/editor-sdk/ui';

  import { untrack } from 'svelte';

  import ConflictsPage from './ConflictsPage.svelte';
  import ImportExportPage from './ImportExportPage.svelte';
  import PluginsPage from './plugins/PluginsPage.svelte';
  import SettingRow from './SettingRow.svelte';
  import { categoryTree, searchSettings, settingsIn } from '../../settings/setting-categories';
  import { SettingsDraft } from '../../settings/settings-draft';
  import { settingsPageApi } from './settings-page-api';
  import { settingsTree } from './settings-tree';
  import { SYNC_STATUS } from './sync-status.const';

  interface Props {
    services: ServiceAccessor;
    onclose: () => void;
    /** Page to show first (a category id or `plugins`, `import`, `conflicts`). */
    page?: string;
  }

  const input: Props = $props();
  // svelte-ignore state_referenced_locally
  const [services, onclose, initialPage] = [input.services, input.onclose, input.page];
  const settings = services.get(SettingsServiceToken);
  const registry = services.get(SettingsRegistryToken);
  const account = services.tryGet(AccountSyncToken);
  const host = services.tryGet(PluginHostToken);
  const commands = services.get(EditorServices.Commands);
  const notifications = services.tryGet(NotificationServiceToken);
  const themes = services.tryGet(ThemeServiceToken)?.themes ?? [];
  const choices: Record<string, { value: string; label: string }[]> = {
    ...(themes.length && {
      'appearance.theme': themes.map((theme) => ({ value: theme.id, label: theme.label })),
    }),
  };
  const draft = new SettingsDraft(settings);
  const status = account?.status;
  const conflicts = account?.conflicts;
  const changes = draft.changes;

  let open = $state(true);
  let query = $state('');
  let revision = $state(0);
  const pageRevision = new ObservableValue(0);
  $effect(() => {
    const bump = () =>
      untrack(() => {
        revision++;
        pageRevision.set(pageRevision.get() + 1);
      });
    const subscription = settings.onDidChange(bump);
    const unsubscribe = draft.changes.subscribe(bump);
    const scopes = draft.scopes.subscribe(bump);
    return () => {
      subscription.dispose();
      unsubscribe();
      scopes();
    };
  });

  const pages = services
    .get(EditorServices.Extensions)
    .getValues(SETTINGS_PAGES)
    .toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title));
  const owned = new Set(pages.flatMap((contributed) => contributed.settings ?? []));
  const pageApi = settingsPageApi(registry, draft, pageRevision.readonly());

  const definitions = registry
    .getAll()
    .filter((definition) => !definition.deprecated && !owned.has(definition.key));
  const pluginsDisabled = registry.get('plugins.disabled');
  const categories = categoryTree(
    host
      ? definitions.filter(
          (definition) => definition !== pluginsDisabled && definition.key !== 'plugins.account',
        )
      : definitions,
  );
  const nodes = $derived(
    settingsTree(categories, pages, { plugins: !!host, conflicts: !!$conflicts?.length }),
  );
  // svelte-ignore state_referenced_locally
  let selected = $state(new Set([initialPage ?? categories[0]?.id ?? 'plugins']));
  // svelte-ignore state_referenced_locally
  let expanded = $state(new Set(categories.map((node) => node.id)));
  const page = $derived([...selected][0] ?? categories[0]?.id ?? '');
  const shown = $derived(
    query.trim() ? searchSettings(definitions, query) : settingsIn(definitions, page),
  );
  const contributedPage = $derived(pages.find((contributed) => contributed.id === page));

  let kept = $state(false);
  void services
    .get(RpcClientToken)
    .api(SessionContract)
    .info(null)
    .then((session) => (kept = session.mode === 'ONLINE' && !session.features.includes('settings')))
    .catch(() => undefined);

  const notify = (kind: 'info' | 'error', title: string, detail?: string) =>
    notifications?.notify(kind, title, detail ? { detail } : {});

  const apply = async () => {
    const failed = await draft.apply();
    for (const { key, error } of failed) {
      notify(
        'error',
        `Could not save ${key}`,
        error instanceof Error ? error.message : String(error),
      );
    }
    return !failed.length;
  };

  const close = () => {
    open = false;
    onclose();
  };

  const editJson = (): MenuEntry[] => [
    ...(settings.hasStore('project')
      ? [
          {
            kind: 'item' as const,
            id: 'project',
            label: 'Project settings (settings.json)',
            onSelect: () => void openFile('.nanoforge/editor/settings.json'),
          },
        ]
      : []),
    ...(settings.hasStore('projectLocal')
      ? [
          {
            kind: 'item' as const,
            id: 'projectLocal',
            label: 'Project, only me (local.json)',
            onSelect: () => void openFile('.nanoforge/editor/local.json'),
          },
        ]
      : []),
  ];

  const openFile = async (path: string) => {
    if (!(await apply())) return;
    close();
    await commands.execute('documents.open', path);
  };
</script>

<Dialog bind:open title="Settings" width="min(1040px, 94vw)" onclose={close}>
  <div class="settings">
    <div class="top">
      <Input bind:value={query} placeholder="Search settings" aria-label="Search settings" />
      {#if $status}
        <span
          class="sync {$status}"
          role="status"
          title={kept
            ? 'Account sync is not available yet: settings stay on this editor.'
            : undefined}
          >{kept && $status === 'idle' ? 'Saved on this editor' : SYNC_STATUS[$status]}</span
        >
      {/if}
      {#if editJson().length}
        <Menu items={editJson()} align="end">
          {#snippet trigger({ props: triggerProps })}
            <Button {...triggerProps} size="sm" variant="ghost" icon="file-code"
              >Edit as JSON</Button
            >
          {/snippet}
        </Menu>
      {/if}
    </div>
    <div class="body">
      <nav aria-label="Settings categories">
        <Tree
          label="Settings categories"
          {nodes}
          bind:expanded
          selected={query.trim() ? new Set() : selected}
          onselectionchange={(next) => {
            selected = next;
            query = '';
          }}
        />
      </nav>
      <div class="content">
        {#if query.trim()}
          {#each shown as definition (definition.key)}
            <SettingRow
              {definition}
              {draft}
              {settings}
              {revision}
              choices={choices[definition.key]}
            />
          {:else}
            <EmptyState icon="search" title="No setting matches" />
          {/each}
        {:else if page === 'plugins' && host && pluginsDisabled}
          <PluginsPage
            {services}
            {host}
            {draft}
            definition={pluginsDisabled}
            {revision}
            onreload={async () => {
              if (await apply()) location.reload();
            }}
          />
        {:else if contributedPage}
          {@const Page = contributedPage.component}
          <Page {services} page={pageApi} />
        {:else if page === 'import'}
          <ImportExportPage {settings} {notify} />
        {:else if page === 'conflicts'}
          <ConflictsPage
            conflicts={$conflicts ?? []}
            onresolve={(key, value) => void account?.resolveConflict(key, value)}
          />
        {:else}
          {#each shown as definition (definition.key)}
            <SettingRow
              {definition}
              {draft}
              {settings}
              {revision}
              choices={choices[definition.key]}
            />
          {:else}
            <EmptyState icon="sliders-horizontal" title="No settings in this category" />
          {/each}
        {/if}
      </div>
    </div>
  </div>
  {#snippet footer()}
    <Button onclick={close}>Cancel</Button>
    <Button disabled={!$changes.size} onclick={() => void apply()}>Apply</Button>
    <Button
      variant="primary"
      onclick={async () => {
        if (await apply()) close();
      }}>OK</Button
    >
  {/snippet}
</Dialog>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    /* The dialog is at most 70vh, with its header and footer. */
    height: min(640px, calc(70vh - 120px));
    min-height: 0;
  }
  .top {
    display: flex;
    gap: var(--nf-space-2);
    align-items: center;
    padding-bottom: var(--nf-space-2);
  }
  .top :global(input) {
    flex: 1;
  }
  .sync {
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
    white-space: nowrap;
  }
  .sync.conflict,
  .sync.error {
    color: var(--nf-color-warning);
  }
  .body {
    display: grid;
    flex: 1;
    grid-template-columns: 240px 1fr;
    min-height: 0;
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-float);
    overflow: hidden;
  }
  nav {
    min-height: 0;
    border-right: 1px solid var(--nf-color-border);
    background: var(--nf-color-sunken);
    overflow: auto;
  }
  .content {
    min-height: 0;
    overflow: auto;
  }
</style>
