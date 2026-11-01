<script lang="ts">
  import type { ServiceAccessor, SettingDefinition } from '@nanoforge-dev/editor-sdk';
  import {
    Button,
    IconThemeServiceToken,
    SYSTEM_THEME,
    Select,
    type ThemeDefinition,
    ThemeServiceToken,
    themeDeclarations,
  } from '@nanoforge-dev/editor-sdk/ui';

  import type { SettingsDraft } from '../../settings/settings-draft';

  /**
   * Editor › Appearance: the themes as cards that preview their own colors (each card holds its
   * theme's variables), first Match the system (light or dark, as the system is now), the density, the icon theme, and Get more themes (the marketplace). Like
   * every setting, a choice is pending until Apply.
   */
  interface Props {
    services: ServiceAccessor;
    draft: SettingsDraft;
    revision: number;
    definitions: readonly SettingDefinition[];
    ongetmore: () => void;
  }

  const { services, draft, revision, definitions, ongetmore }: Props = $props();
  const definition = (key: string) => definitions.find((candidate) => candidate.key === key);
  const theme = $derived(definition('appearance.theme'));
  const density = $derived(definition('appearance.density'));
  const iconTheme = $derived(definition('appearance.iconTheme'));
  // svelte-ignore state_referenced_locally
  const themeService = services.tryGet(ThemeServiceToken);
  const themes = themeService?.themes ?? [];
  const system = themeService?.resolve(SYSTEM_THEME);
  // svelte-ignore state_referenced_locally
  const iconThemes = services.tryGet(IconThemeServiceToken)?.themes ?? [];

  const value = (setting: SettingDefinition | undefined) => {
    void revision;
    return setting ? (draft.valueOf(setting) as string) : '';
  };
  const set = (setting: SettingDefinition | undefined, next: string) => {
    if (setting) draft.set(setting, next);
  };
  const DENSITIES = [
    { value: 'compact', label: 'Compact' },
    { value: 'normal', label: 'Normal' },
    { value: 'comfortable', label: 'Comfortable' },
  ];
</script>

<section class="appearance" aria-label="Appearance">
  <div class="heading">
    <h3>Theme</h3>
    <Button size="sm" icon="search" onclick={ongetmore}>Get more themes</Button>
  </div>
  {#snippet card(id: string, label: string, kind: string, candidate: ThemeDefinition)}
    {@const checked = value(theme) === id}
    <button
      type="button"
      class="card"
      class:checked
      role="radio"
      aria-checked={checked}
      aria-label={label}
      onclick={() => set(theme, id)}
    >
      <span class="preview" style={themeDeclarations(candidate)} aria-hidden="true">
        <span class="bar"><span class="dot"></span><span class="dot"></span></span>
        <span class="body">
          <span class="line strong"></span>
          <span class="line muted"></span>
          <span class="code"
            ><span style:color={candidate.syntax?.keyword ?? 'var(--nf-color-accent-text)'}
              >const</span
            >
            ball =
            <span style:color={candidate.syntax?.number ?? 'var(--nf-color-success)'}>42</span
            ></span
          >
          <span class="pill">Play</span>
        </span>
      </span>
      <span class="name">{label}</span>
      <span class="kind">{kind}</span>
    </button>
  {/snippet}
  <div class="themes" role="radiogroup" aria-label="Theme">
    {#if system}
      {@render card(
        SYSTEM_THEME,
        'Match the system',
        system.kind === 'dark' ? 'Dark now' : 'Light now',
        system,
      )}
    {/if}
    {#each themes as candidate (candidate.id)}
      {@render card(
        candidate.id,
        candidate.label,
        candidate.kind === 'dark' ? 'Dark' : 'Light',
        candidate,
      )}
    {/each}
  </div>

  <div class="row">
    <h3 id="appearance-density">Density</h3>
    <div class="choices" role="radiogroup" aria-labelledby="appearance-density">
      {#each DENSITIES as choice (choice.value)}
        <Button
          size="sm"
          variant={value(density) === choice.value ? 'primary' : 'secondary'}
          role="radio"
          aria-checked={value(density) === choice.value}
          onclick={() => set(density, choice.value)}>{choice.label}</Button
        >
      {/each}
    </div>
  </div>

  <div class="row">
    <h3>Icons</h3>
    <Select
      label="Icon theme"
      value={value(iconTheme)}
      items={iconThemes.map((candidate) => ({ value: candidate.id, label: candidate.label }))}
      onchange={(id) => set(iconTheme, id)}
    />
  </div>
</section>

<style>
  .appearance {
    display: grid;
    gap: var(--nf-space-3);
    margin-bottom: var(--nf-space-4);
    padding-bottom: var(--nf-space-4);
    border-bottom: 1px solid var(--nf-color-border);
  }
  h3 {
    margin: 0;
    font-size: var(--nf-font-size-md);
  }
  .heading,
  .row {
    display: flex;
    gap: var(--nf-space-3);
    align-items: center;
    justify-content: space-between;
  }
  .themes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--nf-space-2);
  }
  .card {
    display: grid;
    gap: 2px;
    padding: var(--nf-space-2);
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-float);
    background: var(--nf-color-surface);
    color: var(--nf-color-text);
    text-align: left;
    cursor: pointer;
  }
  .card.checked {
    border-color: var(--nf-color-accent);
    box-shadow: 0 0 0 1px var(--nf-color-accent);
  }
  .card:focus-visible {
    outline: 2px solid var(--nf-color-focus);
  }
  .preview {
    display: grid;
    overflow: hidden;
    margin-bottom: var(--nf-space-1);
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-control);
    background: var(--nf-color-bg);
  }
  .bar {
    display: flex;
    gap: 3px;
    padding: 4px;
    background: var(--nf-color-surface);
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--nf-color-border-strong);
  }
  .body {
    display: grid;
    gap: 4px;
    padding: 6px;
    background: var(--nf-color-raised);
  }
  .line {
    height: 5px;
    border-radius: 2px;
  }
  .strong {
    width: 70%;
    background: var(--nf-color-text);
  }
  .muted {
    width: 50%;
    background: var(--nf-color-text-muted);
  }
  .code {
    color: var(--nf-color-text);
    font-family: var(--nf-font-code);
    font-size: 10px;
  }
  .pill {
    justify-self: start;
    padding: 0 6px;
    border-radius: 3px;
    background: var(--nf-color-accent);
    color: var(--nf-color-on-accent);
    font-size: 10px;
  }
  .name {
    font-weight: 600;
  }
  .kind {
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .choices {
    display: flex;
    gap: var(--nf-space-1);
  }
</style>
