<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { PUBLIC_PM_URL } from '$env/static/public';

  const basePath = PUBLIC_PM_URL || 'https://projects.nanoforge.eu';
  const createProjectPath = `${basePath}/dashboard/projects`;
  const openProjectPath = `${basePath}/dashboard/projects`;
</script>

<a href={createProjectPath}>
  <Button
    variant="link"
    size="lg"
    class="justify-start gap-2 w-full text-foreground cursor-pointer"
  >
    <span class="i-ic-baseline-open-in-new"></span>
    Create project
  </Button>
</a>

<a href={openProjectPath}>
  <Button
    variant="link"
    size="lg"
    class="justify-start gap-2 w-full text-foreground cursor-pointer"
  >
    <span class="i-ic-baseline-open-in-new"></span>
    Open project
  </Button>
</a>
