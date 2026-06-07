<script lang="ts">
  import { z } from 'zod';
  import Form from '$lib/components/forms/Form.svelte';
  import FormFieldSelect from '$lib/components/forms/inputs/FormFieldSelect.svelte';
  import FormFieldSwitch from '$lib/components/forms/inputs/FormFieldSwitch.svelte';
  import { useForm } from '$lib/components/forms/form.svelte';
  import { LoadingButton } from '$lib/components/ui/loading-button';
  import { runSafe } from '@utils-client/error';
  import { ProjectLoader } from '$lib/client/project';
  import { goto } from '$app/navigation';
  import * as Card from '$lib/components/ui/card';

  interface Props {
    gatewayId: string;
  }

  const { gatewayId }: Props = $props();

  let isLoading = $state(false);

  const schema = z.object({
    language: z.enum(['ts', 'js']).default('ts'),
    multiplayerServer: z.boolean().default(false),
  });

  type CompleteProjectForm = z.infer<typeof schema>;

  const completeProject = async (values: CompleteProjectForm) => {
    isLoading = true;
    await runSafe(
      'create project',
      async () => {
        const project = await ProjectLoader.complete({ ...values, gatewayId });
        await goto(`/dashboard?id=${project.id}`);
      },
      () => {
        isLoading = false;
      },
    );
  };

  const formCtx = useForm<CompleteProjectForm>({
    schema,
    defaultValues: {
      language: 'ts',
      multiplayerServer: false,
    },
    onSubmit: completeProject,
  });

  const { submitting } = formCtx;
</script>

<Card.Root class="w-full max-w-lg p-4">
  <Form form={formCtx} class="w-full">
    <div class="modal-header">
      <div class="modal-icon-badge">
        <span class="i-ic-baseline-check text-primary text-lg"></span>
      </div>
      <div>
        <h2 class="text-sm font-semibold text-foreground tracking-tight leading-tight">
          Init project
        </h2>
        <p class="text-xs text-muted-foreground mt-0.5">Configure and scaffold your project</p>
      </div>
    </div>

    <div class="modal-body">
      <FormFieldSelect
        name="language"
        label="Language"
        classNames={{ trigger: 'w-40 p-4', content: 'p-2', item: 'p-2' }}
        options={[
          { value: 'ts', label: 'Typescript' },
          { value: 'js', label: 'Javascript' },
        ]}
      />

      <div class="flex flex-col gap-1">
        <FormFieldSwitch label="Multiplayer game" name="multiplayerServer" />
      </div>
    </div>

    <div class="modal-footer">
      <LoadingButton
        type="submit"
        size="lg"
        loading={$submitting || isLoading}
        class="btn-primary px-6"
      >
        Init Project
      </LoadingButton>
    </div>
  </Form>
</Card.Root>
