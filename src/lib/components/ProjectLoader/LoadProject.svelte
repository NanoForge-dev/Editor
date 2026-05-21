<script lang="ts">
  import { z } from 'zod';
  import { useForm } from '$lib/components/forms/form.svelte';
  import { ProjectLoader } from '$lib/client/project';
  import FormFieldInput from '$lib/components/forms/inputs/FormFieldInput.svelte';
  import Form from '$lib/components/forms/Form.svelte';
  import ProgressBar from '$lib/components/ProjectLoader/ProgressBar.svelte';
  import { Button } from '$lib/components/ui/button';

  interface Props {
    show: boolean;
    callback?: (projectPath: string) => void;
  }
  let { show = $bindable(), callback }: Props = $props();

  let creationPromises: Promise<unknown>[] = $state([]);

  const schema = z.object({
    path: z.string(),
  });

  type ProjectForm = z.infer<typeof schema>;

  const sf = useForm<ProjectForm>({
    schema,
    defaultValues: {
      path: '',
    },
    onSubmit: loadProject,
  });

  const { submitting } = sf;

  function handleClose(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      show = false;
    }
  }

  export async function loadProject(values: ProjectForm) {
    const projectPromise = ProjectLoader.loadFromCache(values.path);
    creationPromises.push(projectPromise);

    const project = await projectPromise;
    callback?.(project.id);
  }
</script>

<div
  aria-hidden="true"
  class={show
    ? 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'
    : 'hidden'}
  onclick={(e) => e.target === e.currentTarget && (show = false)}
  onkeydown={handleClose}
>
  <Form
    form={sf}
    class="bg-black outline outline-neutral-900 rounded-xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-8"
  >
    <FormFieldInput name="path" label="Project path" placeholder="/path/to/project" />

    <div class="flex gap-3 justify-end mt-4">
      <button
        type="button"
        onclick={() => (show = false)}
        class="px-4 py-2 text-neutral-200 hover:text-neutral-400 cursor-pointer"
      >
        Cancel
      </button>
      <Button
        type="submit"
        disabled={$submitting}
        class="bg-purple-800 text-white px-4 py-2 rounded-lg hover:bg-purple-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        Load
      </Button>
    </div>
  </Form>
</div>

<ProgressBar
  title="Loading project"
  promises={creationPromises}
  show={creationPromises.length > 0}
/>
