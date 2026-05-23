<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';

  import { useProject } from '$lib/client/project';
  import type { SfsDirectoryMap } from '$lib/client/sync-file-system';

  import ContentBrowserContentList from './content-list.svelte';
  import ContentBrowserHeader from './header.svelte';
  import ContentBrowserSideList from './side-list.svelte';
  import ContentBrowserSkeleton from './skeleton.svelte';
  import type { ContentBrowserItem } from './types';

  const { id: projectId, fs } = useProject();

  const contentToItems = (content: SfsDirectoryMap) => {
    const res: ContentBrowserItem[] = [];
    content.files.forEach((file) => {
      res.push({ type: 'file', name: file });
    });
    Object.entries(content.directories).forEach(([name, content]) => {
      res.push({ type: 'dir', name, children: content ? contentToItems(content) : [] });
    });
    return res;
  };

  const query = createQuery(() => ({
    queryKey: ['project-readdir', projectId],
    queryFn: async () => {
      const dir = await fs.getDirectory();
      const content = await dir.readdir();
      const items = contentToItems(content);
      return items.sort((a, b) => a.name.localeCompare(b.name));
    },
  }));
</script>

{#if query.isFetched && !query.isLoading && query.data}
  <div class="h-full w-full flex gap-1 bg-neutral-800 p-1">
    <div class="w-1/5 flex flex-col rounded-l-md rounded-r-sm bg-neutral-900 p-1">
      <ContentBrowserSideList path="" items={query.data.filter((i) => i.type === 'dir')} />
    </div>
    <div class="h-full w-4/5 flex flex-col">
      <ContentBrowserHeader />
      <ContentBrowserContentList items={query.data} />
    </div>
  </div>
{:else}
  <ContentBrowserSkeleton />
{/if}
