<script lang="ts">
  import type { ImportPreview, SettingsService, WritableScope } from '@nanoforge-dev/editor-sdk';
  import { Button, Select } from '@nanoforge-dev/editor-sdk/ui';

  import { SCOPE_LABELS } from '../../settings/setting-categories';

  interface Props {
    settings: SettingsService;
    notify: (kind: 'info' | 'error', title: string, detail?: string) => void;
  }

  const { settings, notify }: Props = $props();
  const scopes = (['account', 'machine', 'project', 'projectLocal'] as const).filter((scope) =>
    settings.hasStore(scope),
  );
  let scope = $state<WritableScope>(
    scopes.includes('machine') ? 'machine' : (scopes[0] ?? 'machine'),
  );
  let preview = $state<ImportPreview>();

  const exportScope = () => {
    const blob = new Blob([settings.export(scope)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `nanoforge-settings-${scope}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const pick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        preview = settings.previewImport(scope, await file.text());
      } catch (error) {
        notify('error', 'This file is not a settings export', String(error));
      }
    };
    input.click();
  };

  const apply = async () => {
    if (!preview) return;
    await settings.applyImport(preview);
    notify('info', `Settings imported into ${SCOPE_LABELS[preview.scope]}`);
    preview = undefined;
  };
</script>

<section class="page" aria-label="Import and export">
  <h2>Import & export</h2>
  <div class="row">
    <Select
      label="Scope"
      value={scope}
      items={scopes.map((value) => ({ value, label: SCOPE_LABELS[value] }))}
      onchange={(value) => {
        scope = value as WritableScope;
        preview = undefined;
      }}
    />
    <Button icon="download" onclick={exportScope}>Export…</Button>
    <Button icon="upload" onclick={pick}>Import…</Button>
  </div>

  {#if preview}
    <div class="preview" role="region" aria-label="Import preview">
      <h3>Importing into {SCOPE_LABELS[preview.scope]}</h3>
      {#each [['Added', preview.added], ['Changed', preview.changed], ['Unknown (kept, unused)', preview.unknown]] as const as [label, keys] (label)}
        {#if keys.length}
          <p><strong>{label}:</strong> {keys.join(', ')}</p>
        {/if}
      {/each}
      {#if preview.rejected.length}
        <p class="rejected">
          <strong>Rejected:</strong>
          {preview.rejected.map((entry) => `${entry.key} (${entry.reason})`).join(', ')}
        </p>
      {/if}
      {#if !preview.added.length && !preview.changed.length}<p>Nothing changes.</p>{/if}
      <div class="row">
        <Button onclick={() => (preview = undefined)}>Cancel</Button>
        <Button variant="primary" onclick={apply}>Import</Button>
      </div>
    </div>
  {/if}
</section>

<style>
  .page {
    padding: var(--nf-space-3) var(--nf-space-4);
  }
  h2 {
    margin: 0 0 var(--nf-space-3);
    font-size: var(--nf-font-size-lg);
  }
  h3 {
    margin: 0 0 var(--nf-space-2);
    font-size: var(--nf-font-size-md);
  }
  .row {
    display: flex;
    gap: var(--nf-space-2);
    align-items: center;
  }
  .preview {
    margin-top: var(--nf-space-4);
    padding: var(--nf-space-3);
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-float);
  }
  .preview p {
    margin: 0 0 var(--nf-space-2);
  }
  .rejected {
    color: var(--nf-color-danger);
  }
</style>
