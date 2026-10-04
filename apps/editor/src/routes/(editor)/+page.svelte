<script lang="ts">
  import { goto } from '$app/navigation';
  import { ProjectsContract, type RecentProject } from '@nanoforge-dev/editor-protocol';
  import {
    Button,
    Checkbox,
    Dialog,
    Icon,
    IconButton,
    Input,
    Select,
    Switch,
  } from '@nanoforge-dev/editor-ui';

  import { getEditor } from '$lib/editor/editor-context';

  const editor = getEditor();
  const session = editor.session;
  const projectsApi = editor.rpc.api(ProjectsContract);

  let recent = $state<RecentProject[]>([]);
  let gateways = $state<{ gatewayId: string; name: string; description: string }[]>([]);
  let path = $state('');
  let error = $state<string>();
  let busy = $state<string>();

  let creating = $state(false);
  let draft = $state({
    name: '',
    language: 'ts' as 'ts' | 'js',
    server: true,
    install: true,
    packageManager: 'npm' as 'npm' | 'pnpm' | 'yarn' | 'bun',
  });
  const nameError = $derived(
    draft.name && !/^[a-z0-9][a-z0-9-]*$/.test(draft.name)
      ? 'Use lowercase letters, digits and dashes'
      : undefined,
  );

  $effect(() => {
    if (!session.user) return;
    editor.projects.recent().then((list) => (recent = list));
    if (session.mode === 'ONLINE') projectsApi.gateways(null).then((list) => (gateways = list));
  });

  const run = async (label: string, task: () => Promise<string>) => {
    error = undefined;
    busy = label;
    try {
      await goto(`/project/${await task()}`);
    } catch (reason) {
      error = reason instanceof Error ? reason.message : String(reason);
    } finally {
      busy = undefined;
    }
  };

  const open = (ref: RecentProject['ref']) =>
    run('Opening project', async () => (await editor.projects.open(ref)).id);
  /** Takes a project out of the list (its files stay where they are). */
  const forget = async (project: RecentProject) => {
    error = undefined;
    try {
      await projectsApi.forget({ id: project.id });
      recent = recent.filter((candidate) => candidate.id !== project.id);
    } catch (reason) {
      error = reason instanceof Error ? reason.message : String(reason);
    }
  };
  const create = () =>
    run('Creating project (nf new)', async () => {
      creating = false;
      const { id } = await projectsApi.create(draft);
      return id;
    });

  const opened = (date: Date) =>
    new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
</script>

<main class="picker">
  <header>
    <h1>NanoForge</h1>
    <p class="who">
      {#if session.user}{session.user.name}{:else}Not signed in{/if}
      <span class="mode"
        >{session.mode === 'OFFLINE' ? 'Local editor' : 'Online editor'} {session.version}</span
      >
    </p>
  </header>

  {#if session.mode === 'ONLINE' && !session.user}
    <section class="panel">
      <h2>Sign in to open your projects</h2>
      <p class="muted">Your projects live on your NanoForge account.</p>
      <Button
        variant="primary"
        onclick={() => session.loginUrl && (location.href = session.loginUrl)}
        >Sign in on NanoForge</Button
      >
    </section>
  {:else}
    <section class="actions" aria-label="Open a project">
      {#if session.mode === 'OFFLINE'}
        <form
          class="open"
          onsubmit={(event) => {
            event.preventDefault();
            if (path.trim()) void open({ path: path.trim() });
          }}
        >
          <Input
            bind:value={path}
            placeholder="Project folder, e.g. my-game"
            aria-label="Project folder"
          />
          <Button type="submit" disabled={!path.trim() || !!busy}>Open</Button>
        </form>
        <Button variant="primary" icon="plus" disabled={!!busy} onclick={() => (creating = true)}
          >New project</Button
        >
      {/if}
    </section>

    {#if busy}<p class="status" role="status">{busy}…</p>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}

    {#if gateways.length}
      <section aria-labelledby="gateways-title">
        <h2 id="gateways-title">Your projects</h2>
        <ul class="list">
          {#each gateways as project (project.gatewayId)}
            <li>
              <button
                type="button"
                class="row"
                onclick={() => open({ gatewayId: project.gatewayId })}
              >
                <Icon name="folder" />
                <span class="name">{project.name}</span>
                <span class="detail">{project.description}</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section aria-labelledby="recent-title">
      <h2 id="recent-title">Recent</h2>
      {#if recent.length}
        <ul class="list">
          {#each recent as project (project.id)}
            <li class="recent">
              <button type="button" class="row" onclick={() => open(project.ref)}>
                <Icon name="folder" />
                <span class="name">{project.name}</span>
                <span class="detail location" title={project.location}
                  ><bdi>{project.location}</bdi></span
                >
                <time>{opened(project.openedAt)}</time>
              </button>
              <IconButton
                icon="x"
                label={`Remove ${project.name} from the recent projects`}
                onclick={() => void forget(project)}
              />
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted">Projects you open appear here.</p>
      {/if}
    </section>
  {/if}
</main>

<Dialog
  bind:open={creating}
  title="New project"
  description="Creates a NanoForge game workspace with nf new."
>
  <form
    class="create"
    onsubmit={(event) => {
      event.preventDefault();
      if (draft.name && !nameError) void create();
    }}
  >
    <label>
      <span>Name</span>
      <Input bind:value={draft.name} placeholder="my-game" invalid={!!nameError} />
    </label>
    {#if nameError}<p class="error">{nameError}</p>{/if}
    <label>
      <span>Language</span>
      <Select
        label="Language"
        value={draft.language}
        items={[
          { value: 'ts', label: 'TypeScript' },
          { value: 'js', label: 'JavaScript' },
        ]}
        onchange={(value) => (draft.language = value)}
      />
    </label>
    <label>
      <span>Package manager</span>
      <Select
        label="Package manager"
        value={draft.packageManager}
        items={[
          { value: 'npm', label: 'npm' },
          { value: 'pnpm', label: 'pnpm' },
          { value: 'yarn', label: 'yarn' },
          { value: 'bun', label: 'bun' },
        ]}
        onchange={(value) => (draft.packageManager = value)}
      />
    </label>
    <div class="inline">
      <Switch label="Multiplayer (adds a server app)" bind:checked={draft.server} />
      <span>Multiplayer (adds a server app)</span>
    </div>
    <Checkbox label="Install dependencies" bind:checked={draft.install} />
    <div class="buttons">
      <Button onclick={() => (creating = false)}>Cancel</Button>
      <Button variant="primary" type="submit" disabled={!draft.name || !!nameError}
        >Create project</Button
      >
    </div>
  </form>
</Dialog>

<style>
  .picker {
    width: min(720px, calc(100vw - 32px));
    height: 100vh;
    margin: 0 auto;
    padding: 12vh 0 var(--nf-space-6);
    overflow: auto;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: var(--nf-space-5);
  }
  h1 {
    margin: 0;
    font-size: 26px;
    font-weight: 600;
    letter-spacing: -0.015em;
  }
  .who {
    margin: 0;
    text-align: right;
  }
  .mode {
    display: block;
    color: var(--nf-color-text-faint);
    font-size: var(--nf-font-size-sm);
  }
  h2 {
    margin: var(--nf-space-5) 0 var(--nf-space-2);
    font-size: var(--nf-font-size-md);
    font-weight: 600;
  }
  .actions {
    display: flex;
    gap: var(--nf-space-2);
  }
  .open {
    display: flex;
    flex: 1;
    gap: var(--nf-space-2);
  }
  .panel {
    padding: var(--nf-space-4);
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-float);
    background: var(--nf-color-surface);
  }
  .panel h2 {
    margin-top: 0;
  }
  .list {
    margin: 0;
    padding: 0;
    border-top: 1px solid var(--nf-color-border);
    list-style: none;
  }
  .row {
    display: grid;
    grid-template-columns: auto minmax(0, 12rem) minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--nf-space-3);
    width: 100%;
    padding: var(--nf-space-2) var(--nf-space-2);
    border: 0;
    border-bottom: 1px solid var(--nf-color-border);
    background: transparent;
    color: var(--nf-color-text-muted);
    text-align: left;
    cursor: pointer;
  }
  .row:hover {
    background: var(--nf-color-surface);
    color: var(--nf-color-text);
  }
  .name {
    overflow: hidden;
    color: var(--nf-color-text);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail {
    overflow: hidden;
    font-size: var(--nf-font-size-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .recent {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--nf-color-border);
  }
  .recent .row {
    flex: 1;
    min-width: 0;
    border-bottom: 0;
  }
  .location {
    direction: rtl;
    text-align: left;
  }
  time {
    color: var(--nf-color-text-faint);
    font-size: var(--nf-font-size-sm);
  }
  .muted,
  .status {
    color: var(--nf-color-text-muted);
  }
  .error {
    margin: var(--nf-space-2) 0 0;
    color: var(--nf-color-danger);
  }
  .create {
    display: grid;
    gap: var(--nf-space-3);
  }
  .create label {
    display: grid;
    gap: var(--nf-space-1);
    color: var(--nf-color-text-muted);
  }
  .inline {
    display: flex;
    align-items: center;
    gap: var(--nf-space-2);
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: var(--nf-space-2);
  }
  @media (max-width: 560px) {
    .row {
      grid-template-columns: auto 1fr;
    }
    .detail,
    time {
      display: none;
    }
    .actions,
    .open {
      flex-direction: column;
    }
  }
</style>
