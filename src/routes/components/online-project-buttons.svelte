<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { env } from '$env/dynamic/public';

  const basePath = env.PUBLIC_PM_URL;
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
