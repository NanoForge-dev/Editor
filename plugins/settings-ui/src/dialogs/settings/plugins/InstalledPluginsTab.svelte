<script lang="ts">
  import type { PluginInfo } from '@nanoforge-dev/editor-sdk';
  import { Button, Switch } from '@nanoforge-dev/editor-sdk/ui';

  import { type KnownPlugin, scopeOf } from '../../../marketplace/marketplace';
  import type { PluginsPageState } from './plugins-page-state.svelte';

  interface Props {
    page: PluginsPageState;
    plugins: readonly PluginInfo[];
    known: readonly KnownPlugin[];
    /** Names of the disabled plugins, with the pending changes. */
    disabled: ReadonlySet<string>;
    ontoggle: (name: string, enabled: boolean) => void;
  }

  const { page, plugins, known, disabled, ontoggle }: Props = $props();

  const STATUS: Record<string, string> = {
    ok: 'active',
    disabled: 'disabled',
    shadowed: 'replaced by another copy',
    'incompatible-editor': 'needs another editor version',
    'incompatible-runtime': 'built for another editor',
    'missing-dependency': 'missing a dependency',
    'dependency-version': 'wrong dependency version',
    'dependency-failed': 'a dependency failed',
    cycle: 'dependency cycle',
  };
  const SOURCE: Record<string, string> = {
    bundled: 'built in',
    installed: 'installed for me',
    project: 'installed for this project',
    dev: 'development',
  };
</script>

<p class="hint">
  Enabling, disabling, installing or removing a plugin takes effect after a reload of the editor.
</p>
<ul class="installed" aria-label="Installed plugins">
  {#each plugins as plugin (`${plugin.descriptor.source}:${plugin.name}`)}
    {@const enabled = !disabled.has(plugin.name)}
    {@const scope = scopeOf(plugin.descriptor.source)}
    {@const change = page.pending.get(plugin.name)}
    {@const label = plugin.descriptor.manifest.displayName ?? plugin.name}
    {@const update = page.newest.get(plugin.name)}
    <li class="row">
      <div class="text">
        <span class="name">{label}</span>
        <span class="meta">
          {plugin.name} · {plugin.descriptor.manifest.version} ·
          {SOURCE[plugin.descriptor.source] ?? plugin.descriptor.source} ·
          {change === 'removed'
            ? 'removed, reload to finish'
            : change
              ? `${change.version} installed, reload to finish`
              : plugin.status.kind === 'ok'
                ? plugin.state
                : (STATUS[plugin.status.kind] ?? plugin.status.kind)}
        </span>
        {#if plugin.descriptor.manifest.description}
          <span class="description">{plugin.descriptor.manifest.description}</span>
        {/if}
      </div>
      {#if scope && !change}
        {#if page.busy === plugin.name}
          <Button size="sm" disabled>Working…</Button>
        {:else}
          {#if update && update !== plugin.descriptor.manifest.version}
            <Button
              size="sm"
              variant="primary"
              aria-label={`Update ${label} to ${update}`}
              onclick={() => void page.install(plugin.name, scope)}>Update to {update}</Button
            >
          {/if}
          <Button
            size="sm"
            aria-label={`Uninstall ${label}`}
            onclick={() => void page.uninstall(plugin.name, scope)}>Uninstall</Button
          >
        {/if}
      {/if}
      <Switch
        checked={enabled}
        label={`${enabled ? 'Disable' : 'Enable'} ${label}`}
        onchange={(checked) => ontoggle(plugin.name, checked)}
      />
    </li>
  {/each}
  {#each [...page.pending].filter(([name, change]) => change !== 'removed' && !known.some((plugin) => plugin.name === name && scopeOf(plugin.source))) as [name, change] (name)}
    <li class="row">
      <div class="text">
        <span class="name">{name}</span>
        <span class="meta">
          {name} · {change !== 'removed' ? change.version : ''} · installed, reload to finish
        </span>
      </div>
    </li>
  {/each}
</ul>

<style>
  .hint {
    margin: 0 0 var(--nf-space-2);
    color: var(--nf-color-text-muted);
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  /* The list scrolls inside the page, under the tabs. */
  .installed {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .row {
    display: flex;
    gap: var(--nf-space-3);
    align-items: center;
    padding: var(--nf-space-2) 0;
    border-bottom: 1px solid var(--nf-color-border);
  }
  .text {
    display: grid;
    flex: 1;
    gap: 2px;
    min-width: 0;
  }
  .name {
    font-weight: 600;
  }
  .meta,
  .description {
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
</style>
