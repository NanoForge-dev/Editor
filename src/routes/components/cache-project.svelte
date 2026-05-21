<script lang="ts">
  import DefaultProjectCover from '$lib/assets/defaultProjectCover.png';
  import type { ProjectDataCache } from '$lib/client/project';

  interface Props {
    project: ProjectDataCache;
  }

  const { project }: Props = $props();
</script>

<button
  class="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left w-full cursor-pointer"
>
  <img
    alt="{project.name ?? 'Unknown'} cover"
    src={project.imageUrl || DefaultProjectCover}
    class="size-9 rounded-md object-cover shrink-0"
  />
  <span class="flex flex-col min-w-0">
    <span class="text-sm font-medium truncate">{project.name ?? 'Unknown'}</span>
    <span class="text-xs text-muted-foreground truncate">{project.resolvable}</span>
  </span>
</button>
