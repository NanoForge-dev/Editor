<script lang="ts">
  import { cn } from '@utils/ui';

  import type { ContentBrowserItem } from './types';

  interface Props {
    item: ContentBrowserItem;
    class?: string;
  }

  const DIR_ICON = 'i-material-icon-theme-folder-interceptor';

  const FILE_ICONS: [RegExp, string][] = [
    [/^.*\.ts$/, 'i-material-icon-theme-typescript'],
    [/^.*\.js$/, 'i-material-icon-theme-javascript'],
    [/^.*\.fbx$/, 'i-material-icon-theme-3d'],
    [/^.*\.(mp3|wav|flac)$/, 'i-material-icon-theme-lyric'],
    [/^.*\.json$/, 'i-material-icon-theme-json'],
    [/^\.gitignore$/, 'i-material-icon-theme-git'],
    [/^.*\.(png|jpg|jpeg|gif|svg|webp)$/, 'i-material-icon-theme-image'],
  ];

  const { item, class: className }: Props = $props();

  const getFileIcon = () => {
    const [, icon] = FILE_ICONS.find(([regex]) => regex.test(item.name)) ?? [
      undefined,
      'i-material-icon-theme-file',
    ];
    return icon;
  };
</script>

{#if item.type === 'dir'}
  <span class={cn(DIR_ICON, className)}></span>
{:else}
  <span class={cn(getFileIcon(), className)}></span>
{/if}
