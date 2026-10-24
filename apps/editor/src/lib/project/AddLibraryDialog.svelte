<script lang="ts">
  import { validateFolder, validatePackageName } from '@nanoforge-dev/editor-project';
  import type { AppModel } from '@nanoforge-dev/editor-protocol';
  import { Button, Checkbox, Dialog, Input } from '@nanoforge-dev/editor-ui';

  interface Props {
    /** Name of the project, for the default package name. */
    project: string;
    apps: readonly AppModel[];
    exists: (path: string) => boolean;
    oncreate: (library: { folder: string; packageName: string; usedBy: AppModel[] }) => void;
    onclose: () => void;
  }

  const { project, apps, exists, oncreate, onclose }: Props = $props();
  let open = $state(true);
  let folder = $state('shared');
  /** The package name follows the folder until it is typed. */
  let typedName = $state<string>();
  const packageName = $derived(typedName ?? `@${project.replace(/^@|\/.*$/g, '')}/${folder}`);
  // svelte-ignore state_referenced_locally
  let users = $state(new Set(apps.map((app) => app.id)));

  const folderError = $derived(validateFolder({ exists }, 'libs', folder));
  const nameError = $derived(validatePackageName(packageName));
  const close = () => {
    open = false;
    onclose();
  };
</script>

<Dialog bind:open title="Add shared library" width="min(460px, 92vw)" onclose={close}>
  <form
    class="form"
    onsubmit={(event) => {
      event.preventDefault();
      if (folderError || nameError) return;
      oncreate({ folder, packageName, usedBy: apps.filter((app) => users.has(app.id)) });
      close();
    }}
  >
    <p class="hint">
      Components and systems that several apps share. It is created in <code>libs/{folder}</code>.
    </p>
    <label>
      <span>Folder in libs/</span>
      <Input bind:value={folder} aria-label="Folder in libs/" invalid={!!folderError} />
      {#if folderError}<span class="error" role="alert">{folderError}</span>{/if}
    </label>
    <label>
      <span>Package name (how apps import it)</span>
      <Input
        value={packageName}
        oninput={(event: Event) => (typedName = (event.currentTarget as HTMLInputElement).value)}
        aria-label="Package name"
        invalid={!!nameError}
      />
      {#if nameError}<span class="error" role="alert">{nameError}</span>{/if}
    </label>
    {#if apps.length}
      <fieldset>
        <legend>Used by</legend>
        {#each apps as app (app.id)}
          <Checkbox
            label={app.name}
            checked={users.has(app.id)}
            onchange={(checked) => {
              // eslint-disable-next-line svelte/prefer-svelte-reactivity -- replaced, not mutated
              const next = new Set(users);
              if (checked) next.add(app.id);
              else next.delete(app.id);
              users = next;
            }}
          />
        {/each}
      </fieldset>
    {/if}
    <div class="buttons">
      <Button onclick={close}>Cancel</Button>
      <Button variant="primary" type="submit" disabled={!!folderError || !!nameError}
        >Add library</Button
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
  fieldset {
    display: grid;
    gap: var(--nf-space-1);
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    padding: 0 0 var(--nf-space-1);
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
