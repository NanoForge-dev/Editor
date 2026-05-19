<script lang="ts">
  import { z } from 'zod';
  import ProgressBar from '$lib/components/ProjectLoader/ProgressBar.svelte';
  import Form from '$lib/components/forms/Form.svelte';
  import FormField from '$lib/components/forms/FormField.svelte';
  import FormFieldInput from '$lib/components/forms/inputs/FormFieldInput.svelte';
  import { useForm } from '$lib/components/forms/form.svelte';
  import { Button } from 'flowbite-svelte';
  import { ProjectLoader } from '$lib/client/project/project-loader/project-loader';

  interface Props {
    show: boolean;
    callback?: (projectPath: string) => void;
  }
  let { show = $bindable(), callback }: Props = $props();

  let projectLoading: Promise<void> | null = $state(null);
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

  const form = useForm<ProjectForm>({
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
    schema,
    onSubmit: newProject,
  });

  function handleClose(event: KeyboardEvent) {
    if (event.key === 'Escape') show = false;
  }

  async function newProject(values: ProjectForm) {
    const project = await ProjectLoader.create(values);
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
    {form}
    class="bg-black outline outline-neutral-900 rounded-xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-8"
  >
    <FormFieldInput
      name="projectName"
      label="Project name"
      placeholder="nanoforge-app"
      classNames={{ input: 'w-1/2 rounded-lg px-3 py-2 outline outline-neutral-800 text-sm' }}
    />

    <div class="flex w-full justify-center">
      <button
        type="button"
        class="text-sm w-fit font-semibold cursor-pointer hover:text-neutral-300"
        onclick={() => (showAdvancedSettings = !showAdvancedSettings)}
      >
        <span>Advanced settings</span>
        <span
          class={showAdvancedSettings
            ? 'i-ic-baseline-arrow-drop-up'
            : 'i-ic-baseline-arrow-drop-down'}
        ></span>
      </button>
    </div>

    {#if showAdvancedSettings}
      <FormFieldInput
        name="projectPath"
        label="Project path"
        placeholder="/tmp"
        classNames={{ input: 'w-1/2 rounded-lg px-3 py-2 outline outline-neutral-800 text-sm' }}
      />

      <FormField label="Package manager" name="packageManager">
        {#snippet children({ id, name, value, handleChange })}
          <select
            {id}
            {name}
            {value}
            class="bg-neutral-900 px-3 py-2 rounded-md cursor-pointer w-1/2"
            onchange={handleChange}
          >
            <option value="npm">npm</option>
            <option value="yarn">yarn</option>
            <option value="pnpm">pnpm</option>
            <option value="bun">bun</option>
          </select>
        {/snippet}
      </FormField>

      <FormField label="Language" name="language">
        {#snippet children({ id, name, value, handleChange })}
          <select
            {id}
            {name}
            {value}
            class="bg-neutral-900 px-3 py-2 rounded-md cursor-pointer w-1/2"
            onchange={handleChange}
          >
            <option value="ts">TypeScript</option>
            <option value="js">JavaScript</option>
          </select>
        {/snippet}
      </FormField>

      <FormField label="Multiplayer Server" name="multiplayerServer">
        {#snippet children({ id, name, value, handleChange })}
          <input
            {id}
            {name}
            checked={value}
            type="checkbox"
            class="cursor-pointer"
            onchange={handleChange}
          />
        {/snippet}
      </FormField>

      <FormField label="Docker containerization" name="dockerContainerization">
        {#snippet children({ id, name, value, handleChange })}
          <input
            {id}
            {name}
            checked={value}
            type="checkbox"
            class="cursor-pointer"
            onchange={handleChange}
          />
        {/snippet}
      </FormField>

      <FormField label="Create Git Repository" name="createGitRepository">
        {#snippet children({ id, name, value, handleChange })}
          <input
            {id}
            {name}
            checked={value}
            type="checkbox"
            class="cursor-pointer"
            onchange={handleChange}
          />
        {/snippet}
      </FormField>

      {#if form.values.createGitRepository}
        <FormFieldInput
          name="gitRemote"
          label="Git Remote"
          classNames={{ input: 'w-1/2 rounded-lg px-3 py-2 outline outline-neutral-800 text-sm' }}
        />
      {/if}
    {/if}

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
        disabled={form.isSubmitting}
        class="bg-purple-800 text-white px-4 py-2 rounded-lg hover:bg-purple-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        Create
      </Button>
    </div>
  </Form>
</div>

{#if projectLoading !== null}
  <ProgressBar
    title="Creating project"
    promises={[projectLoading]}
    show={true}
    callback={() => newProject(form.values)}
  />
{/if}
