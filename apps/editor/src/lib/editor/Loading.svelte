<script lang="ts">
  import type { ErrorDescription } from './error-description';

  interface Props {
    step?: string;
    /** What is happening during this step, in plain words. */
    description?: string;
    progress?: number;
    error?: ErrorDescription;
  }

  const { step = '', description, progress = 0, error }: Props = $props();
  let running = $state<string>();

  const run = async (label: string, action: () => void | Promise<void>) => {
    running = label;
    try {
      await action();
    } finally {
      running = undefined;
    }
  };
</script>

<main class="loading" aria-busy={!error}>
  <p class="brand">NanoForge</p>
  {#if error}
    <h1 class="title">{error.title}</h1>
    {#if error.hint}<p class="hint">{error.hint}</p>{/if}
    {#if error.actions.length}
      <div class="actions">
        {#each error.actions as action (action.label)}
          <button
            type="button"
            class:primary={action.primary}
            disabled={!!running}
            onclick={() => run(action.label, action.run)}
          >
            {running === action.label ? `${action.label}…` : action.label}
          </button>
        {/each}
      </div>
    {/if}
    {#if error.detail}<p class="detail" role="alert">{error.detail}</p>{/if}
  {:else}
    <div
      class="bar"
      role="progressbar"
      aria-label={step}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={Math.round(progress * 100)}
    >
      <span style:width="{Math.max(6, progress * 100)}%"></span>
    </div>
    <div class="status" aria-live="polite">
      <p class="step">{step}</p>
      {#if description}<p class="description">{description}</p>{/if}
    </div>
  {/if}
</main>

<style>
  /* Also shown before the theme loads: every token has a fallback. */
  .loading {
    display: grid;
    align-content: center;
    justify-items: start;
    gap: var(--nf-space-3, 12px);
    width: min(420px, calc(100vw - 32px));
    min-height: 100vh;
    margin: 0 auto;
  }
  .brand {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .title {
    margin: var(--nf-space-2, 8px) 0 0;
    font-size: var(--nf-font-size-lg, 15px);
    font-weight: 600;
  }
  .bar {
    width: 100%;
    height: 3px;
    overflow: hidden;
    border-radius: 2px;
    background: var(--nf-color-border, #2a3140);
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--nf-temper, #855bdd);
    transition: width 240ms ease-out;
  }
  .status {
    display: grid;
    gap: 2px;
    min-height: 40px;
  }
  .step {
    margin: 0;
    font-weight: 500;
  }
  .description,
  .hint {
    margin: 0;
    color: var(--nf-color-text-muted, #949cae);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nf-space-2, 8px);
  }
  button {
    height: 28px;
    padding: 0 var(--nf-space-3, 12px);
    border: 1px solid var(--nf-color-border, #2a3140);
    border-radius: var(--nf-radius-control, 3px);
    background: var(--nf-color-raised, #222834);
    color: inherit;
    font: inherit;
    font-weight: 500;
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    border-color: var(--nf-color-border-strong, #3a4356);
  }
  button.primary {
    border-color: transparent;
    background: var(--nf-color-accent, #855bdd);
    color: var(--nf-color-on-accent, #ffffff);
  }
  button.primary:hover:not(:disabled) {
    background: var(--nf-color-accent-hover, #9067ea);
  }
  button:disabled {
    opacity: 0.6;
    cursor: default;
  }
  button:focus-visible {
    outline: 2px solid var(--nf-color-focus, #6d91ea);
    outline-offset: 2px;
  }
  .detail {
    margin: var(--nf-space-2, 8px) 0 0;
    color: var(--nf-color-text-faint, #626a7d);
    font-family: var(--nf-font-code, ui-monospace, monospace);
    font-size: var(--nf-font-size-sm, 12px);
    overflow-wrap: anywhere;
  }
</style>
