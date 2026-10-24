<script lang="ts">
  import { validateFolder, validatePackageName } from '@nanoforge-dev/editor-project';
  import type { AppModel } from '@nanoforge-dev/editor-protocol';
  import { Button, Dialog, Input, Select } from '@nanoforge-dev/editor-ui';

  interface Props {
    type: 'client' | 'server';
    project: string;
    /** The clients and servers of the project. */
    apps: readonly AppModel[];
    exists: (path: string) => boolean;
    oncreate: (app: {
      type: 'client' | 'server';
      folder: string;
      name: string;
      from?: AppModel;
    }) => void;
    onclose: () => void;
  }

  const { type, project, apps, exists, oncreate, onclose }: Props = $props();
  const sameType = $derived(apps.filter((app) => app.type === type));
  let open = $state(true);
  // svelte-ignore state_referenced_locally
  let folder = $state(apps.some((app) => app.root === `apps/${type}`) ? `${type}-2` : type);
  let typedName = $state<string>();
  const name = $derived(typedName ?? `${project.replace(/^@[^/]*\//, '')}-${folder}`);
  /** `''`: an empty app; else the id of the app to copy. */
  let from = $state('');

  const folderError = $derived(validateFolder({ exists }, 'apps', folder));
  const nameError = $derived(
    validatePackageName(name) ??
      (apps.some((app) => app.name === name)
        ? `${name} is already the name of an app.`
        : undefined),
  );
  const close = () => {
    open = false;
    onclose();
  };
</script>

<Dialog bind:open title={`Add ${type} app`} width="min(460px, 92vw)" onclose={close}>
  <form
    class="form"
    onsubmit={(event) => {
      event.preventDefault();
      if (folderError || nameError) return;
      const source = sameType.find((app) => app.id === from);
      oncreate({ type, folder, name, ...(source && { from: source }) });
      close();
    }}
  >
    <p class="hint">
      {type === 'client' ? 'A game the players run.' : 'A game server.'} It is created in
      <code>apps/{folder}</code>.
    </p>
    <label>
      <span>Folder in apps/</span>
      <Input bind:value={folder} aria-label="Folder in apps/" invalid={!!folderError} />
      {#if folderError}<span class="error" role="alert">{folderError}</span>{/if}
    </label>
    <label>
      <span>Name</span>
      <Input
        value={name}
        oninput={(event: Event) => (typedName = (event.currentTarget as HTMLInputElement).value)}
        aria-label="Name"
        invalid={!!nameError}
      />
      {#if nameError}<span class="error" role="alert">{nameError}</span>{/if}
    </label>
    <label>
      <span>Start from</span>
      <Select
        label="Start from"
        value={from}
        items={[
          { value: '', label: 'An empty app' },
          ...sameType.map((app) => ({ value: app.id, label: `A copy of ${app.name}` })),
        ]}
        onchange={(value) => (from = value)}
      />
    </label>
    <div class="buttons">
      <Button onclick={close}>Cancel</Button>
      <Button variant="primary" type="submit" disabled={!!folderError || !!nameError}
        >Add app</Button
      >
    </div>
  </form>
</Dialog>

<style>
  .form {
    display: grid;
    gap: var(--nf-space-3);
  }
  .hint {
    margin: 0;
    color: var(--nf-color-text-muted);
  }
  label {
    display: grid;
    gap: var(--nf-space-1);
  }
  .error {
    color: var(--nf-color-danger);
    font-size: var(--nf-font-size-sm);
  }
  .buttons {
    display: flex;
    gap: var(--nf-space-2);
    justify-content: flex-end;
  }
</style>
