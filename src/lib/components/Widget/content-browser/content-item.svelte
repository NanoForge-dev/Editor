<script lang="ts">
  import { useProject } from '$lib/client/project';
  import { tabsStore } from '$lib/components/Tabs/store';
  import type { TabTypeId } from '$lib/components/Tabs/types';
  import { TooltipText } from '$lib/components/ui/tooltip-text';

  import ContentBrowserIcon from './icon.svelte';
  import { currentDir } from './store';
  import type { ContentBrowserItem } from './types';
  import { joinPath } from './utils';

  interface Props {
    item: ContentBrowserItem;
  }
  let { item }: Props = $props();

  const { fs } = useProject();

  const FILE_TYPES: [TabTypeId, string[]][] = [
    ['ts', ['ts', 'js']],
    ['3d', ['fbd']],
    ['song', ['mp3', 'wav', 'flac']],
    ['img', ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']],
  ];

  const getType = () => {
    const [type] = FILE_TYPES.find(([, exts]) => exts.includes(item.name.split('.').pop()!)) ?? [
      'unknown',
    ];
    return type;
  };

  const handleClick = async () => {
    const path = joinPath($currentDir, item.name);

    if (item.type === 'dir') {
      currentDir.set(path);
      return;
    }

    const file = await fs.getFile(path);

    await tabsStore.openTab({
      type: getType(),
      title: item.name,
      file: await file.getFile(),
    });
  };
</script>

<TooltipText text={item.name}>
  <button
    class="h-32 w-24 flex flex-col cursor-pointer items-center rounded-md p-1 hover:bg-neutral-700"
    onclick={handleClick}
  >
    <span class="w-full aspect-square bg-neutral-900 flex items-center justify-center rounded p-2">
      <ContentBrowserIcon {item} class="w-full h-full text-neutral-600 text-2xl" />
    </span>
    <span class="my-2 w-full text-neutral-300 text-sm text-truncate">{item.name}</span>
  </button>
</TooltipText>
