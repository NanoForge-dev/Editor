<script lang="ts">
  import {
    BASE_CSS,
    Button,
    Dialog,
    KIT_CSS,
    Menu,
    NotificationService,
    Select,
    Toasts,
    Tooltip,
    nanoforgeDark,
    nanoforgeLight,
    themeDeclarations,
  } from '@nanoforge-dev/editor-ui';

  import KitSamples from './KitSamples.svelte';

  /**
   * Every kit component in both themes, side by side, and the floating layers in their order
   * (dock < float < dialog < menu < toast): a menu, a select and a tooltip must open above a
   * dialog. Dev builds only (`/kit`).
   */
  const notifications = new NotificationService();
  let dialog = $state(false);
  let side = $state('client');
  /** Floating layers are put in the page's body: they take this theme. */
  let floating = $state<'dark' | 'light'>('dark');

  /** The kit's own CSS, as the editor shell injects it. */
  $effect(() => {
    const style = document.createElement('style');
    style.textContent = `@layer reset, ui;\n@layer reset {${BASE_CSS}}\n@layer ui {${KIT_CSS}}`;
    document.head.append(style);
    return () => style.remove();
  });

  $effect(() => {
    const root = document.documentElement;
    root.setAttribute(
      'style',
      themeDeclarations(floating === 'dark' ? nanoforgeDark : nanoforgeLight),
    );
    return () => root.removeAttribute('style');
  });
</script>

<main class="playground">
  <header>
    <h1>Kit</h1>
    <div class="floating">
      <Select
        value={floating}
        label="Theme of floating layers"
        items={[
          { value: 'dark', label: 'Floating layers: dark' },
          { value: 'light', label: 'Floating layers: light' },
        ]}
        onchange={(value) => (floating = value)}
      />
    </div>
    <Button variant="primary" onclick={() => (dialog = true)}>Open a dialog</Button>
    <Button onclick={() => notifications.notify('info', 'Saved', { detail: 'A toast above all.' })}
      >Show a toast</Button
    >
  </header>

  <div class="themes">
    {#each [nanoforgeDark, nanoforgeLight] as theme (theme.id)}
      <section class="theme" style={themeDeclarations(theme)} aria-label={theme.label}>
        <h2>{theme.label}</h2>
        <KitSamples name={theme.kind} />
      </section>
    {/each}
  </div>
</main>

<Dialog open={dialog} title="Z-order" onclose={() => (dialog = false)}>
  <p>The menu, the select and the tooltip open above this dialog.</p>
  <div class="row">
    <Menu
      items={[
        { kind: 'item', id: 'a', label: 'Above the dialog', onSelect: () => {} },
        { kind: 'item', id: 'b', label: 'Another entry', onSelect: () => {} },
      ]}
    >
      {#snippet trigger({ props })}
        <Button {...props}>Menu</Button>
      {/snippet}
    </Menu>
    <Select
      value={side}
      label="Side in the dialog"
      items={[
        { value: 'client', label: 'Client' },
        { value: 'server', label: 'Server' },
      ]}
      onchange={(value) => (side = value)}
    />
    <Tooltip text="Above the dialog">
      {#snippet children({ props })}
        <Button {...props}>Tooltip</Button>
      {/snippet}
    </Tooltip>
    <Button onclick={() => notifications.notify('warning', 'Above the dialog too')}>Toast</Button>
  </div>
  {#snippet footer()}
    <Button variant="primary" onclick={() => (dialog = false)}>Close</Button>
  {/snippet}
</Dialog>

<Toasts {notifications} />

<style>
  .playground {
    min-height: 100vh;
    background: var(--nf-color-bg);
    color: var(--nf-color-text);
  }
  header {
    display: flex;
    gap: var(--nf-space-3);
    align-items: center;
    padding: var(--nf-space-3) var(--nf-space-4);
    border-bottom: 1px solid var(--nf-color-border);
  }
  .floating {
    width: 220px;
  }
  h1 {
    margin: 0 auto 0 0;
    font-size: var(--nf-font-size-lg);
  }
  .themes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  }
  .theme {
    padding: var(--nf-space-4);
    background: var(--nf-color-surface);
    color: var(--nf-color-text);
  }
  h2 {
    margin: 0 0 var(--nf-space-3);
    font-size: var(--nf-font-size-md);
  }
  .row {
    display: flex;
    gap: var(--nf-space-2);
    align-items: center;
  }
</style>
