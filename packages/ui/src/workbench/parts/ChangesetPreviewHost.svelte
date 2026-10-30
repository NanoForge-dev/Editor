<script lang="ts">
  import Button from '../../components/button.svelte';
  import Dialog from '../../components/dialog.svelte';
  import { type DiffLine, diffHunks, diffLines } from '../changeset/diff-lines';
  import { getWorkbenchContext } from '../workbench-context';

  /** The pending changeset preview: each file's changed lines, then Cancel or Apply. */
  const { changesets } = getWorkbenchContext();
  const current = changesets.current;
  let open = $derived(!!$current);

  const files = $derived(
    ($current?.files ?? []).map((file) => {
      const lines = diffLines(file.before, file.after);
      return {
        ...file,
        status:
          file.before === undefined ? 'New' : file.after === undefined ? 'Removed' : 'Changed',
        added: lines.filter((line) => line.kind === '+').length,
        removed: lines.filter((line) => line.kind === '-').length,
        hunks: diffHunks(lines),
      };
    }),
  );
  const number = (line: DiffLine) => (line.kind === '+' ? line.new : line.old);
</script>

{#if $current}
  <Dialog
    bind:open
    title={$current.title}
    width="920px"
    description="{files.length} {files.length === 1
      ? 'file'
      : 'files'}: look at the changes, then apply them as one step you can undo."
    onclose={() => $current?.resolve(false)}
  >
    {#if $current.notes?.length}
      <ul class="notes">
        {#each $current.notes as note (note)}<li>{note}</li>{/each}
      </ul>
    {/if}
    <div class="files">
      {#each files as file (file.path)}
        <section class="file" aria-label={file.path}>
          <header>
            <span class="status" data-status={file.status}>{file.status}</span>
            <code>{file.path}</code>
            <span class="counts">+{file.added} −{file.removed}</span>
          </header>
          {#if file.after !== undefined || file.before !== undefined}
            <div class="diff" role="table" aria-label="Changes of {file.path}">
              {#each file.hunks as hunk, index (index)}
                {#if index > 0}<div class="gap" aria-hidden="true">⋯</div>{/if}
                {#each hunk.lines as line, row (row)}
                  <div class="line" data-kind={line.kind} role="row">
                    <span class="number" role="cell">{number(line) ?? ''}</span>
                    <span class="mark" role="cell">{line.kind === ' ' ? '' : line.kind}</span>
                    <span class="text" role="cell">{line.text}</span>
                  </div>
                {/each}
              {/each}
            </div>
          {/if}
        </section>
      {/each}
    </div>
    {#snippet footer()}
      <Button onclick={() => $current?.resolve(false)}>Cancel</Button>
      <Button variant="primary" onclick={() => $current?.resolve(true)}
        >{$current?.confirm ?? 'Apply'}</Button
      >
    {/snippet}
  </Dialog>
{/if}

<style>
  .notes {
    margin: 0 0 var(--nf-space-3);
    padding-left: var(--nf-space-4);
    color: var(--nf-color-warning);
  }
  .files {
    display: grid;
    gap: var(--nf-space-3);
  }
  .file {
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-control);
    overflow: hidden;
  }
  header {
    display: flex;
    gap: var(--nf-space-2);
    align-items: center;
    padding: var(--nf-space-1) var(--nf-space-2);
    background: var(--nf-color-surface);
  }
  .status {
    font-size: var(--nf-font-size-sm);
    color: var(--nf-color-text-muted);
  }
  .status[data-status='New'] {
    color: var(--nf-color-success, #3fb950);
  }
  .status[data-status='Removed'] {
    color: var(--nf-color-danger);
  }
  .counts {
    margin-left: auto;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .diff {
    overflow-x: auto;
    font-family: var(--nf-font-mono, monospace);
    font-size: var(--nf-font-size-sm);
  }
  .line {
    display: grid;
    grid-template-columns: 4ch 2ch 1fr;
    white-space: pre;
  }
  .line[data-kind='+'] {
    background: color-mix(in srgb, var(--nf-color-success, #3fb950) 15%, transparent);
  }
  .line[data-kind='-'] {
    background: color-mix(in srgb, var(--nf-color-danger) 15%, transparent);
  }
  .number {
    padding-right: var(--nf-space-1);
    color: var(--nf-color-text-muted);
    text-align: right;
    user-select: none;
  }
  .mark {
    color: var(--nf-color-text-muted);
    user-select: none;
  }
  .gap {
    padding-left: 6ch;
    color: var(--nf-color-text-muted);
  }
</style>
