<script lang="ts">
  import * as Breadcrumb from '$lib/components/ui/breadcrumb';
  import { Button } from '$lib/components/ui/button';

  import { currentDir } from './store';

  const onDirClick = (index: number) => {
    const dirs = $currentDir.split('/');
    currentDir.set(dirs.slice(0, index).join('/'));
  };

  const [dirs, current] = $derived.by(() => {
    if (!$currentDir) return [[], '/'];
    const dirs = ['/', ...$currentDir.split('/')];
    const last = dirs.pop();
    return [dirs, last];
  });
</script>

<div class="h-fit flex items-center px-1 pb-2 pt-1">
  <Breadcrumb.Root>
    <Breadcrumb.List>
      {#each dirs as dir, i (i)}
        <Breadcrumb.Item>
          <Button variant="ghost" onclick={() => onDirClick(i)}>
            {dir}
          </Button>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
      {/each}
      <Breadcrumb.Item>
        <Button variant="ghost">{current}</Button>
      </Breadcrumb.Item>
    </Breadcrumb.List>
  </Breadcrumb.Root>
</div>
