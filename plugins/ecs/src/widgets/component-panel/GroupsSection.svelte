<script lang="ts">
  import type { ParamGroup } from '@nanoforge-dev/editor-sdk';
  import { Button, ColorPicker, IconButton, Input, Switch } from '@nanoforge-dev/editor-sdk/ui';

  import { hexColor } from '../../model/arg-values';

  interface Props {
    groups: readonly ParamGroup[];
    readonly: boolean;
    onadd: () => void;
    onrename: (group: ParamGroup, name: string) => void;
    onupdate: (group: ParamGroup, change: Partial<ParamGroup>, label: string) => void;
    onremove: (group: ParamGroup) => void;
  }

  const { groups, readonly, onadd, onrename, onupdate, onremove }: Props = $props();
</script>

<section aria-label="Groups">
  <header>
    <h3>Groups</h3>
    <Button size="sm" icon="plus" disabled={readonly} onclick={onadd}>New group</Button>
  </header>
  {#each groups as group (group.name)}
    <div class="group-row" role="group" aria-label="Group {group.name}">
      <Input
        aria-label="Name of group {group.name}"
        value={group.name}
        disabled={readonly}
        onchange={(event) => onrename(group, (event.currentTarget as HTMLInputElement).value)}
      />
      <ColorPicker
        label="Color of group {group.name}"
        value={hexColor(group.color) ?? '#ffffff'}
        disabled={readonly}
        onchange={(value, final) =>
          final && onupdate(group, { color: value }, `Color group ${group.name}`)}
      />
      <Switch
        label="Hide group {group.name}"
        checked={group.hidden ?? false}
        disabled={readonly}
        onchange={(hidden) => onupdate(group, { hidden }, `Hide group ${group.name}`)}
      />
      <IconButton
        icon="trash-2"
        label="Remove group {group.name}"
        disabled={readonly}
        onclick={() => onremove(group)}
      />
      <Input
        class="wide"
        aria-label="Description of group {group.name}"
        placeholder="Description"
        value={group.description ?? ''}
        disabled={readonly}
        onchange={(event) =>
          onupdate(
            group,
            { description: (event.currentTarget as HTMLInputElement).value.trim() },
            `Describe group ${group.name}`,
          )}
      />
    </div>
  {/each}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: var(--nf-space-1);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h3 {
    margin: 0;
    font-size: var(--nf-font-size-sm);
    font-weight: 600;
  }
  .group-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: var(--nf-space-1);
    align-items: center;
  }
  .group-row :global(.wide),
  .group-row > :global(input:first-child) {
    grid-column: 1 / -1;
  }
</style>
