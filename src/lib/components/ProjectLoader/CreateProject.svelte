<script lang="ts">
  import { z } from 'zod';
  import Form from '$lib/components/forms/Form.svelte';
  import FormFieldInput from '$lib/components/forms/inputs/FormFieldInput.svelte';
  import FormFieldSelect from '$lib/components/forms/inputs/FormFieldSelect.svelte';
  import FormFieldSwitch from '$lib/components/forms/inputs/FormFieldSwitch.svelte';
  import { useForm } from '$lib/components/forms/form.svelte';
  import { ProjectLoader } from '$lib/client/project/project-loader/project-loader';
  import { LoadingButton } from '$lib/components/ui/loading-button';
  import { Button } from '$lib/components/ui/button';

  interface Props {
    onClose?: () => void;
  }
  let { onClose }: Props = $props();

  let showAdvancedSettings: boolean = $state(false);

  const schema = z.object({
    projectName: z.string().min(1, 'Project name is required'),
    projectPath: z.string().optional(),
    packageManager: z.enum(['npm', 'yarn', 'pnpm', 'bun']).default('pnpm'),
    language: z.enum(['ts', 'js']).default('ts'),
    multiplayerServer: z.boolean().default(false),
    dockerContainerization: z.boolean().default(false),
    createGitRepository: z.boolean().default(false),
    gitRemote: z.string().optional(),
  });

  type ProjectForm = z.infer<typeof schema>;

  const formCtx = useForm<ProjectForm>({
    schema,
    defaultValues: {
      projectName: '',
      projectPath: '',
      packageManager: 'pnpm',
      language: 'ts',
      multiplayerServer: false,
      dockerContainerization: false,
      createGitRepository: false,
      gitRemote: '',
    },
    onSubmit: newProject,
  });

  const { form, submitting } = formCtx;

  async function newProject(values: ProjectForm) {
    const project = await ProjectLoader.create(values);
    window.location.assign(`/dashboard?id=${project.id}`);
  }
</script>

<Form form={formCtx} class="w-full">
  <div class="modal-header">
    <div class="modal-icon-badge">
      <span class="i-ic-baseline-add text-primary text-lg"></span>
    </div>
    <div>
      <h2 class="text-sm font-semibold text-foreground tracking-tight leading-tight">
        Create project
      </h2>
      <p class="text-xs text-muted-foreground mt-0.5">Scaffold a new workspace</p>
    </div>
  </div>

  <div class="modal-divider"></div>

  <div class="modal-body">
    <FormFieldInput name="projectName" label="Project name" placeholder="nanoforge-app" />

    <button
      type="button"
      class="group flex items-center gap-3 cursor-pointer w-full"
      onclick={() => (showAdvancedSettings = !showAdvancedSettings)}
    >
      <span
        class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground transition-colors duration-150"
      >
        Advanced
        <span
          class={showAdvancedSettings
            ? 'i-ic-baseline-keyboard-arrow-up text-sm'
            : 'i-ic-baseline-keyboard-arrow-down text-sm'}
        ></span>
      </span>
    </button>

    {#if showAdvancedSettings}
      <div class="flex flex-col gap-5">
        <FormFieldInput name="projectPath" label="Project path" placeholder="/home/user/projects" />

        <div class="grid grid-cols-2 gap-3">
          <FormFieldSelect
            name="packageManager"
            label="Package manager"
            classNames={{ trigger: 'w-40 p-4', content: 'p-2', item: 'p-2' }}
            options={[
              { value: 'npm', label: 'npm' },
              { value: 'yarn', label: 'yarn' },
              { value: 'pnpm', label: 'pnpm' },
              { value: 'bun', label: 'bun' },
            ]}
          />
          <FormFieldSelect
            name="language"
            label="Language"
            classNames={{ trigger: 'w-40 p-4', content: 'p-2', item: 'p-2' }}
            options={[
              { value: 'ts', label: 'Typescript' },
              { value: 'js', label: 'Javascript' },
            ]}
          />
        </div>

        <div class="flex flex-col gap-1">
          <button
            type="button"
            class="toggle-row"
            onclick={() =>
              form.update((s) => ({ ...s, multiplayerServer: !$form.multiplayerServer }))}
          >
            <div>
              <p class="toggle-row-title">Multiplayer server</p>
              <p class="toggle-row-desc">Enable real-time collaboration</p>
            </div>
            <FormFieldSwitch
              name="multiplayerServer"
              label="Multiplayer server"
              classNames={{ label: 'hidden' }}
            />
          </button>
          <button
            type="button"
            class="toggle-row"
            onclick={() =>
              form.update((s) => ({
                ...s,
                dockerContainerization: !$form.dockerContainerization,
              }))}
          >
            <div>
              <p class="toggle-row-title">Docker containerization</p>
              <p class="toggle-row-desc">Bundle with a Dockerfile</p>
            </div>
            <FormFieldSwitch
              name="dockerContainerization"
              label="Docker containerization"
              classNames={{ label: 'hidden' }}
            />
          </button>
          <button
            type="button"
            class="toggle-row"
            onclick={() =>
              form.update((s) => ({ ...s, createGitRepository: !$form.createGitRepository }))}
          >
            <div>
              <p class="toggle-row-title">Git repository</p>
              <p class="toggle-row-desc">Initialize with git init</p>
            </div>
            <FormFieldSwitch
              name="createGitRepository"
              label="Git repository"
              classNames={{ label: 'hidden' }}
            />
          </button>
        </div>

        {#if $form.createGitRepository}
          <FormFieldInput
            name="gitRemote"
            label="Git remote URL"
            placeholder="https://github.com/user/repo.git"
          />
        {/if}
      </div>
    {/if}
  </div>

  <div class="modal-footer">
    <Button type="button" variant="ghost" onclick={onClose} class="btn-ghost">Cancel</Button>
    <LoadingButton type="submit" loading={$submitting} class="btn-primary">
      Create project
    </LoadingButton>
  </div>
</Form>
