<script lang="ts">
  import { formatValue } from '../../model/scene-params';
  import type { VarModel, VarUse } from '../../model/vars-model.type';

  interface Props {
    field: VarModel;
    uses: readonly VarUse[];
    /** The scenes that make the var. */
    owners: readonly string[];
    /** Whether a game runs; its value of the var, when it has one. */
    playing: boolean;
    value: { value: unknown; persistent?: boolean; owner?: string | undefined } | undefined;
    open: boolean;
    ontoggle: () => void;
    onopen: (use: VarUse) => void;
  }

  const { field, uses, owners, playing, value, open, ontoggle, onopen }: Props = $props();

  const where = (use: VarUse) => `${use.path.split('/').at(-1)}:${use.line}`;
</script>

<li data-var={field.name} aria-label={field.name} class:unused={!uses.length}>
  <button class="row" aria-expanded={open} onclick={ontoggle}>
    <span class="name">{field.name}</span>
    <span class="type">{field.type}</span>
    {#if field.default}<span class="default">= {field.default}</span>{/if}
    <span class="detail">
      {owners.length ? `made by ${owners.join(', ')}` : ''}
      {uses.length ? `· ${uses.length} use${uses.length > 1 ? 's' : ''}` : '· unused'}
    </span>
  </button>
  {#if playing}
    <p class="live" aria-label="Live value of {field.name}">
      {#if value}
        <span class="value">{formatValue(value.value)}</span>
        <span class="owner"
          >{value.persistent ? 'persistent' : value.owner ? `of ${value.owner}` : ''}</span
        >
      {:else}
        <span class="owner">not set in the game</span>
      {/if}
    </p>
  {/if}
  {#if field.description}<p class="description">{field.description}</p>{/if}
  {#if open}
    <ul class="uses" aria-label="Uses of {field.name}">
      {#each uses as use (`${use.path}:${use.start}`)}
        <li>
          <button class="link" onclick={() => onopen(use)}>
            <span class="kind">{use.kind}</span>
            {use.className ?? ''}
            <span class="where">{where(use)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</li>

<style>
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    padding: 2px var(--nf-space-2);
  }
  li.unused .name {
    color: var(--nf-color-text-muted);
  }
  .row,
  .link {
    display: flex;
    gap: var(--nf-space-2);
    align-items: baseline;
    width: 100%;
    padding: 2px 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .row:hover,
  .link:hover {
    background: var(--nf-color-hover, rgba(127, 127, 127, 0.1));
  }
  .name {
    font-weight: 600;
  }
  .type,
  .default,
  .detail,
  .where,
  .kind {
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .detail,
  .where {
    margin-left: auto;
  }
  .kind {
    min-width: 3.5em;
  }
  .live {
    display: flex;
    gap: var(--nf-space-2);
    margin: 0;
    font-size: var(--nf-font-size-sm);
  }
  .value {
    color: var(--nf-color-success, #6ab04c);
    font-family: var(--nf-font-mono, monospace);
  }
  .owner {
    color: var(--nf-color-text-muted);
  }
  .description {
    margin: 0 0 var(--nf-space-1);
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .uses {
    padding-left: var(--nf-space-3, 12px);
  }
</style>
