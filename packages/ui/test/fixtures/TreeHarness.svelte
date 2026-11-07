<script lang="ts">
  import Tree from '../../src/components/tree.svelte';
  import type { DropPosition, TreeNode } from '../../src/components/tree-model';

  interface Props {
    nodes: TreeNode[];
    onrename?: (id: string, name: string) => void;
    onactivate?: (id: string) => void;
    ondrop?: (ids: string[], target: string, position: DropPosition) => void;
  }

  const { nodes, onrename, onactivate, ondrop }: Props = $props();
  let expanded = $state(new Set<string>());
  let selected = $state(new Set<string>());
</script>

<div style="height: 240px">
  <Tree label="Entities" {nodes} bind:expanded bind:selected {onrename} {onactivate} {ondrop} />
</div>
<output data-testid="selected">{[...selected].join(',')}</output>
<output data-testid="expanded">{[...expanded].join(',')}</output>
