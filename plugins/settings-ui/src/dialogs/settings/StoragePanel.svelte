<script lang="ts">
  import {
    type CacheUsage,
    ProjectCachesToken,
    ProjectServiceToken,
    type ServiceAccessor,
  } from '@nanoforge-dev/editor-sdk';
  import { Button, Switch } from '@nanoforge-dev/editor-sdk/ui';

  /**
   * What the browser keeps of the user's projects (Settings › Editor › Storage), above the
   * budget and expiry settings: the space each project takes, and ways to clear it.
   */
  const { services }: { services: ServiceAccessor } = $props();
  // svelte-ignore state_referenced_locally
  const caches = services.tryGet(ProjectCachesToken);
  // svelte-ignore state_referenced_locally
  const projects = services.tryGet(ProjectServiceToken);

  let usage = $state<CacheUsage>();
  let names = $state<Record<string, string>>({});
  let busy = $state(false);
  let failed = $state<string>();

  const load = async () => {
    if (!caches) return;
    usage = await caches.usage();
    const recent = await projects?.recent().catch(() => []);
    names = Object.fromEntries((recent ?? []).map(({ id, name }) => [id, name]));
  };
  $effect(() => void load());

  const run = async (task: () => Promise<unknown>) => {
    busy = true;
    failed = undefined;
    try {
      await task();
      await load();
    } catch (error) {
      failed = error instanceof Error ? error.message : String(error);
    } finally {
      busy = false;
    }
  };

  const size = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${Math.ceil(bytes / 1024)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  const date = (time: number) =>
    new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(time));
  const canPersist = typeof navigator !== 'undefined' && !!navigator.storage?.persist;
</script>

<section class="storage" aria-labelledby="storage-title">
  <h3 id="storage-title">Files kept in this browser</h3>
  {#if !caches}
    <p class="muted">This browser can't keep project files: they are downloaded each time.</p>
  {:else if !usage}
    <p class="muted" role="status">Measuring…</p>
  {:else}
    <p>
      Project files are kept here so they need not be downloaded again: {size(usage.bytes)} of
      {size(usage.budget)}. A file several projects have is kept once.
    </p>
    {#if usage.projects.length}
      <ul class="projects" aria-label="Kept projects">
        {#each [...usage.projects].sort((a, b) => b.bytes - a.bytes) as project (project.projectId)}
          {@const name = names[project.projectId] ?? project.projectId}
          <li>
            <span class="name">{name}</span>
            <span class="detail"
              >{size(project.bytes)} · {project.files} files · opened {date(project.opened)}</span
            >
            <Button
              size="sm"
              disabled={busy}
              aria-label={`Clear the files kept of ${name}`}
              onclick={() => run(() => caches.clearProject(project.projectId))}>Clear</Button
            >
          </li>
        {/each}
      </ul>
    {/if}
    <div class="actions">
      <Button disabled={busy || !usage.bytes} onclick={() => run(() => caches.clearAll())}
        >Clear all</Button
      >
      {#if canPersist}
        <Switch
          label="Keep these files when the browser runs short of space"
          checked={usage.persisted}
          disabled={busy || usage.persisted}
          onchange={(on) => on && void run(() => navigator.storage.persist())}
        />
        {#if usage.persisted}<span class="muted"
            >Kept: the browser will not remove them on its own.</span
          >{:else}<span class="muted">Keep them when the browser runs short of space</span>{/if}
      {/if}
    </div>
    {#if failed}<p class="error" role="alert">{failed}</p>{/if}
  {/if}
</section>

<style>
  .storage {
    display: flex;
    flex-direction: column;
    gap: var(--nf-space-2);
    padding: var(--nf-space-3);
    border-bottom: 1px solid var(--nf-color-border);
  }
  h3 {
    margin: 0;
    font-size: var(--nf-font-size-md);
  }
  p {
    margin: 0;
  }
  .muted,
  .detail {
    color: var(--nf-color-text-muted);
  }
  .projects {
    display: flex;
    flex-direction: column;
    gap: var(--nf-space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    gap: var(--nf-space-2);
    align-items: center;
  }
  .name {
    font-weight: 600;
  }
  .detail {
    flex: 1;
    font-size: var(--nf-font-size-sm);
  }
  .actions {
    display: flex;
    gap: var(--nf-space-3);
    align-items: center;
  }
  .error {
    color: var(--nf-color-danger);
  }
</style>
