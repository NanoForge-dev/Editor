<script lang="ts">
  import { Button } from '$lib/components/ui/button';

  interface Props {
    handleCreateProject: () => void;
    handleOpenProject: () => void;
  }

  const { handleCreateProject, handleOpenProject }: Props = $props();
</script>

<Button
  variant="ghost"
  size="lg"
  class="justify-start gap-2 w-full cursor-pointer"
  onclick={handleCreateProject}
>
  <span class="i-ic-baseline-add"></span>
  Create project
</Button>

<Button
  variant="ghost"
  size="lg"
  class="justify-start gap-2 w-full cursor-pointer"
  onclick={handleOpenProject}
>
  <span class="i-ic-baseline-folder-open"></span>
  Open project
</Button>
