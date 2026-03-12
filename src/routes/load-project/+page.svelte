<script lang="ts">
  import { resolve } from '$app/paths';
  import Logo from '$lib/assets/logo.png';
  import type { ActionData, PageData } from './$types';
  import { goto } from '$app/navigation';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<div class="h-screen flex flex-col gap-1">
  <header class="h-16 flex bg-neutral-900">
    <div class="h-full w-full flex">
      <a href={resolve('/')} class="h-full px-3 pb-1 pt-2">
        <img src={Logo} alt="Logo" class="h-full rounded-full" />
      </a>
      <div class="h-full w-full flex flex-col justify-between">
        {#if !data.success}
          <div style="white-space:pre; color:red">
            {'Error: ' + data.errorMsg}
          </div>
        {/if}
        {#if form?.errorMsg}
          <div style="white-space:pre; color:red">
            {'Error: ' + form?.errorMsg}
          </div>
        {/if}
        {#if data.creationPanel === 'local'}
          <form
            onsubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              // eslint-disable-next-line svelte/no-navigation-without-resolve
              goto(`/load-project?projectPath=${formData.get('projectPath')}`);
            }}
          >
            <input name="projectPath" placeholder="Project path" />
            <input type="submit" value="Go to project" />
          </form>
          <form
            onsubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              fetch('/cli?/createProject', {
                method: 'POST',
                body: JSON.stringify({
                  projectPath: formData.get('projectPath'),
                  projectName: formData.get('projectName'),
                  packageManager: formData.get('packageManager'),
                  language: formData.get('language'),
                  strictTypeChecking: formData.get('strictTypeChecking') ?? false,
                  multiplayerServer: formData.get('multiplayerServer') ?? false,
                  skipDependencyInstallation: formData.get('skipDependencyInstallation') ?? false,
                  dockerContainerization: formData.get('dockerContainerization') ?? false,
                }),
              });
            }}
          >
            <input name="projectPath" placeholder="Project local path" />
            <input name="projectName" placeholder="Project Name" />
            <label for="packageManagerId">Package manager :</label>
            <select name="packageManager" id="packageManagerId">
              <option value="npm">npm</option>
              <option value="yarn">yarn</option>
              <option value="pnpm">pnpm</option>
              <option value="bun">bun</option>
            </select>
            <label for="languageId">Project language :</label>
            <select name="language" id="languageId">
              <option value="js">js</option>
              <option value="ts">ts</option>
            </select>

            <label for="strictTypeCheckingId">Strict Type Checking :</label>
            <input
              type="checkbox"
              name="strictTypeChecking"
              value="true"
              id="strictTypeCheckingId"
            />
            <label for="multiplayerServerId">Multiplayer Server :</label>
            <input type="checkbox" name="multiplayerServer" value="true" id="multiplayerServerId" />
            <label for="skipDependencyInstallationId">Skip Dependency Installation :</label>
            <input
              type="checkbox"
              name="skipDependencyInstallation"
              value="true"
              id="skipDependencyInstallationId"
            />
            <label for="dockerContainerizationId">Docker containerization :</label>
            <input
              type="checkbox"
              name="dockerContainerization"
              value="true"
              id="dockerContainerizationId"
            />
            <button type="submit" value="Create Local Project">Create Local Project</button>
          </form>
        {/if}
      </div>
    </div>
  </header>
</div>
