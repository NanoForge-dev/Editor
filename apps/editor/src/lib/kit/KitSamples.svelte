<script lang="ts">
  import {
    Button,
    Checkbox,
    ColorPicker,
    Combobox,
    EmptyState,
    IconButton,
    Input,
    Menu,
    type MenuEntry,
    NumberInput,
    PropertyGrid,
    type PropertyField,
    Select,
    Switch,
    Tabs,
    Tooltip,
    Tree,
    type TreeNode,
    Vector2Input,
  } from '@nanoforge-dev/editor-ui';
  import { SvelteSet } from 'svelte/reactivity';

  /** Which pane this is: its controls get distinct names. */
  const { name }: { name: string } = $props();

  let checked = $state(true);
  let on = $state(false);
  let text = $state('Ball');
  let number = $state(42);
  let vector = $state({ x: 1.5, y: -2 });
  let color = $state('#7c5cff');
  let choice = $state('client');
  let found = $state('position');
  let tab = $state('files');
  const expanded = new SvelteSet(['apps']);
  const values = $state<Record<string, unknown>>({
    name: 'Paddle',
    speed: 3,
    solid: true,
    tint: '#ffffff',
    size: { x: 10, y: 80 },
    side: 'client',
  });

  const MENU: MenuEntry[] = [
    {
      kind: 'item',
      id: 'new',
      label: 'New file…',
      icon: 'file',
      shortcut: 'Ctrl+N',
      onSelect: () => {},
    },
    { kind: 'item', id: 'open', label: 'Open…', onSelect: () => {}, disabled: true },
    { kind: 'separator' },
    {
      kind: 'submenu',
      label: 'Recent',
      items: [{ kind: 'item', id: 'pong', label: 'pong-network', onSelect: () => {} }],
    },
  ];
  const NODES: TreeNode[] = [
    {
      id: 'apps',
      label: 'apps',
      icon: 'folder',
      children: [
        { id: 'apps/main.ts', label: 'main.ts', icon: 'file-code', detail: 'M', tone: 'modified' },
        { id: 'apps/new.ts', label: 'new.ts', icon: 'file-code', detail: 'A', tone: 'added' },
      ],
    },
    { id: 'package.json', label: 'package.json', icon: 'file-json' },
  ];
  const FIELDS: PropertyField[] = [
    { key: 'name', label: 'Name', type: 'string' },
    { key: 'speed', label: 'Speed', type: 'number', step: 0.5, min: 0 },
    { key: 'solid', label: 'Solid', type: 'boolean' },
    { key: 'tint', label: 'Tint', type: 'color' },
    { key: 'size', label: 'Size', type: 'vector2' },
    {
      key: 'side',
      label: 'Side',
      type: 'enum',
      options: [
        { value: 'client', label: 'Client' },
        { value: 'server', label: 'Server' },
      ],
    },
  ];
</script>

<div class="samples">
  <section>
    <h3>Buttons</h3>
    <div class="row">
      <Button variant="primary" icon="play">Play</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger" icon="trash-2">Delete</Button>
      <Button size="sm" disabled>Disabled</Button>
      <IconButton icon="settings" label="Settings ({name})" />
      <IconButton icon="eye" label="Shown ({name})" pressed />
    </div>
  </section>

  <section>
    <h3>Inputs</h3>
    <div class="grid">
      <Input bind:value={text} aria-label="Name ({name})" />
      <Input value="not an identifier" invalid aria-label="Invalid name ({name})" />
      <NumberInput value={number} label="Speed ({name})" onchange={(value) => (number = value)} />
      <Vector2Input
        value={vector}
        label="Position ({name})"
        onchange={(value) => (vector = value)}
      />
      <ColorPicker value={color} label="Color ({name})" onchange={(value) => (color = value)} />
      <Select
        value={choice}
        label="Side ({name})"
        items={[
          { value: 'client', label: 'Client' },
          { value: 'server', label: 'Server' },
          { value: 'shared', label: 'Shared', disabled: true },
        ]}
        onchange={(value) => (choice = value)}
      />
      <Combobox
        value={found}
        label="Component ({name})"
        items={[
          { value: 'position', label: 'Position', detail: 'shared' },
          { value: 'velocity', label: 'Velocity', detail: 'client' },
        ]}
        onchange={(value) => (found = value)}
      />
    </div>
    <div class="row">
      <Checkbox {checked} label="Include ({name})" onchange={(value) => (checked = value)} />
      <Switch checked={on} label="Live mode ({name})" onchange={(value) => (on = value)} />
    </div>
  </section>

  <section>
    <h3>Tabs, menu, tooltip</h3>
    <Tabs
      label="Panels ({name})"
      active={tab}
      items={[
        { id: 'files', label: 'Files', icon: 'folder' },
        { id: 'git', label: 'Git', icon: 'git-branch' },
      ]}
      onchange={(id) => (tab = id)}
    />
    <div class="row">
      <Menu items={MENU}>
        {#snippet trigger({ props })}
          <Button {...props}>File ({name})</Button>
        {/snippet}
      </Menu>
      <Tooltip text="Runs the game">
        {#snippet children({ props })}
          <Button {...props} icon="play">Hover me ({name})</Button>
        {/snippet}
      </Tooltip>
    </div>
  </section>

  <section>
    <h3>Tree</h3>
    <Tree nodes={NODES} label="Files ({name})" {expanded} />
  </section>

  <section>
    <h3>Property grid</h3>
    <PropertyGrid
      fields={FIELDS}
      {values}
      label="Paddle ({name})"
      onchange={(key, value) => (values[key] = value)}
    />
  </section>

  <section>
    <h3>Empty state</h3>
    <EmptyState
      icon="box"
      title="No entity selected"
      description="Select an entity in the hierarchy."
    >
      {#snippet actions()}
        <Button size="sm">New entity</Button>
      {/snippet}
    </EmptyState>
  </section>
</div>

<style>
  .samples {
    display: flex;
    flex-direction: column;
    gap: var(--nf-space-4);
  }
  h3 {
    margin: 0 0 var(--nf-space-2);
    font-size: var(--nf-font-size-sm);
    color: var(--nf-color-text-muted);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nf-space-2);
    align-items: center;
    margin-top: var(--nf-space-2);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--nf-space-2);
  }
</style>
