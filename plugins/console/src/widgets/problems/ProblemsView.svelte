<script lang="ts">
  import {
    type CodeDiagnostic,
    DiagnosticsServiceToken,
    DocumentServiceToken,
    EditorServices,
  } from '@nanoforge-dev/editor-sdk';
  import {
    EmptyState,
    Icon,
    IconButton,
    Input,
    type WidgetInstance,
  } from '@nanoforge-dev/editor-sdk/ui';

  import { type Severity, groupProblems, origin, positionAt } from '../../problems/group-problems';

  interface SavedState {
    severities?: Partial<Record<Severity, boolean>>;
  }

  const SEVERITIES = [
    { id: 'error', label: 'Errors', icon: 'circle-alert' },
    { id: 'warning', label: 'Warnings', icon: 'triangle-alert' },
    { id: 'info', label: 'Infos', icon: 'info' },
  ] as const;
  const ICON = { error: 'circle-alert', warning: 'triangle-alert', info: 'info' } as const;

  const { instance }: { instance: WidgetInstance } = $props();
  // svelte-ignore state_referenced_locally
  const { services } = instance;
  const commands = services.get(EditorServices.Commands);
  const all = services.get(DiagnosticsServiceToken).all;

  // svelte-ignore state_referenced_locally
  let severities = $state<Record<Severity, boolean>>({
    error: true,
    warning: true,
    info: true,
    ...instance.getState<SavedState>()?.severities,
  });
  $effect(() => instance.setState({ severities: { ...severities } }));
  let query = $state('');
  let collapsed = $state<readonly string[]>([]);

  const groups = $derived(groupProblems($all, { severities, query }));
  const total = $derived([...$all.values()].reduce((sum, list) => sum + list.length, 0));

  const toggle = (key: string) => {
    collapsed = collapsed.includes(key)
      ? collapsed.filter((other) => other !== key)
      : [...collapsed, key];
  };

  const counts = (errors: number, warnings: number) =>
    [
      errors && `${errors} error${errors > 1 ? 's' : ''}`,
      warnings && `${warnings} warning${warnings > 1 ? 's' : ''}`,
    ]
      .filter(Boolean)
      .join(', ');

  const position = (problem: CodeDiagnostic) =>
    problem.line ? `${problem.line}:${problem.column ?? 1}` : '';

  const open = async (problem: CodeDiagnostic) => {
    if (!problem.path) return;
    let where = problem.line ? { line: problem.line, column: problem.column ?? 1 } : undefined;
    if (!where && problem.start >= 0) {
      const text = await services
        .tryGet(DocumentServiceToken)
        ?.getText(problem.path)
        .catch(() => undefined);
      if (text !== undefined) where = positionAt(text, problem.start);
    }
    await commands.execute('documents.open', problem.path, where ?? {});
  };
</script>

<div class="problems">
  <div class="toolbar">
    <div class="severities" role="group" aria-label="Severities">
      {#each SEVERITIES as severity (severity.id)}
        <IconButton
          icon={severity.icon}
          label={severity.label}
          pressed={severities[severity.id]}
          onclick={() => (severities[severity.id] = !severities[severity.id])}
        />
      {/each}
    </div>
    <Input bind:value={query} placeholder="Search problems" aria-label="Search problems" />
  </div>
  <div class="list" role="list" aria-label="Problems">
    {#each groups as group (group.key)}
      {@const open_ = !collapsed.includes(group.key)}
      <section role="listitem" aria-label={group.label}>
        <button type="button" class="file" aria-expanded={open_} onclick={() => toggle(group.key)}>
          <Icon name={open_ ? 'chevron-down' : 'chevron-right'} size={14} />
          <span class="path">{group.label}</span>
          <span class="counts">{counts(group.errors, group.warnings)}</span>
        </button>
        {#if open_}
          {#each group.problems as problem, index (index)}
            <button
              type="button"
              class="problem {problem.severity}"
              disabled={!problem.path}
              title={problem.message}
              onclick={() => void open(problem)}
            >
              <Icon name={ICON[problem.severity]} size={14} label={problem.severity} />
              <span class="message">{problem.message.split('\n')[0]}</span>
              <span class="origin">{origin(problem)}</span>
              {#if position(problem)}<span class="position">{position(problem)}</span>{/if}
            </button>
          {/each}
        {/if}
      </section>
    {:else}
      <EmptyState
        icon="circle-check"
        title={total ? 'No problems match the filters' : 'No problems'}
        description={total
          ? 'Show more severities or change the search.'
          : 'Errors and warnings of the project appear here.'}
      />
    {/each}
  </div>
</div>

<style>
  .problems {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .toolbar {
    display: flex;
    flex: none;
    gap: var(--nf-space-2);
    align-items: center;
    padding: var(--nf-space-1) var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
  }
  .toolbar :global(input) {
    flex: 1;
    min-width: 0;
  }
  .severities {
    display: flex;
    gap: var(--nf-space-1);
  }
  .list {
    flex: 1;
    min-height: 0;
    overflow: auto;
    font-size: var(--nf-font-size-sm);
  }
  .file,
  .problem {
    display: flex;
    gap: var(--nf-space-2);
    align-items: center;
    width: 100%;
    padding: 2px var(--nf-space-2);
    border: 0;
    background: none;
    color: var(--nf-color-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .file:hover,
  .problem:hover:not(:disabled) {
    background: var(--nf-color-hover);
  }
  .file:focus-visible,
  .problem:focus-visible {
    outline: 1px solid var(--nf-color-focus);
    outline-offset: -1px;
  }
  .file :global(svg),
  .problem :global(svg) {
    flex: none;
  }
  .path {
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .counts,
  .origin,
  .position {
    flex: none;
    color: var(--nf-color-text-faint);
  }
  .problem {
    padding-left: calc(var(--nf-space-4) + var(--nf-space-2));
  }
  .problem:disabled {
    cursor: default;
  }
  .message {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .position {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
  }
  .error :global(svg) {
    color: var(--nf-color-danger);
  }
  .warning :global(svg) {
    color: var(--nf-color-warning);
  }
  .info :global(svg) {
    color: var(--nf-color-text-muted);
  }
</style>
