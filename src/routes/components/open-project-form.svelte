<script lang="ts">
  import { z } from 'zod';
  import Form from '$lib/components/forms/Form.svelte';
  import FormFieldInput from '$lib/components/forms/inputs/FormFieldInput.svelte';
  import { useForm } from '$lib/components/forms/form.svelte';
  import { LoadingButton } from '$lib/components/ui/loading-button';
  import { Button } from '$lib/components/ui/button';
  import { ProjectLoader } from '$lib/client/project';
  import { goto } from '$app/navigation';
  import { runSafe } from '@utils-client/error';

  interface Props {
    onClose?: () => void;
  }
  let { onClose }: Props = $props();

  const schema = z.object({
    path: z.string().min(1, 'Path is required'),
  });

  type ProjectForm = z.infer<typeof schema>;

  const formCtx = useForm<ProjectForm>({
    schema,
    defaultValues: {
      path: '',
    },
    onSubmit: openProject,
  });

  const { form, submitting } = formCtx;

  async function openProject(values: ProjectForm) {
    await runSafe('open project', async () => {
      const project = await ProjectLoader.loadFromPath(values.path);
      await goto(`/dashboard?id=${project.id}`);
    });
  }

  const projectPath = $derived.by(() => {
    let path = $form['path'] || '';
    if (!path.startsWith('/')) {
      if (!path.startsWith('./') && !path.startsWith('../')) path = `./${path}`;
    }
    return path;
  });
</script>

<Form form={formCtx} class="w-full">
  <div class="modal-header">
    <div class="modal-icon-badge">
      <span class="i-ic-baseline-folder-open text-primary text-lg"></span>
    </div>
    <div>
      <h2 class="text-sm font-semibold text-foreground tracking-tight leading-tight">
        Open project
      </h2>
      <p class="text-xs text-muted-foreground mt-0.5">Open a project</p>
    </div>
  </div>

  <div class="modal-divider"></div>

  <div class="modal-body">
    <FormFieldInput
      name="path"
      label="Project path"
      placeholder="/home/user/project"
      description={`The path will be '${projectPath}'`}
    />
  </div>

  <div class="modal-footer">
    <Button type="button" variant="ghost" onclick={onClose} class="btn-ghost">Cancel</Button>
    <LoadingButton type="submit" loading={$submitting} class="btn-primary">
      Open project
    </LoadingButton>
  </div>
</Form>
