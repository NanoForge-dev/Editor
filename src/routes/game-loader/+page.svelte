<script lang="ts">
  import { resolve } from '$app/paths';
  import Logo from '$lib/assets/logo.png';
  import { deserialize } from '$app/forms';

  let manifest = $state([]);
  let buildFile = $state(undefined);
  let componentManifest = $state(undefined);
  let save = $state(undefined);
  let env = $state(undefined);
</script>

<div class="h-screen flex flex-col gap-1">
  <header class="h-16 flex bg-neutral-900">
    <div class="h-full w-full flex">
      <a href={resolve('/')} class="h-full px-3 pb-1 pt-2">
        <img src={Logo} alt="Logo" class="h-full rounded-full" />
      </a>
      <div class="h-full w-full flex flex-col justify-between">
        <div class="h-full w-full flex flex-col justify-between">
          <form
            onsubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const response = await fetch('/game-loader?/getManifest', {
                method: 'POST',
                body: JSON.stringify({ side: formData.get('side') }),
              });
              const result = deserialize(await response.text());
              if (result.type === 'success' && result.data) {
                manifest = result.data.manifest.files;
              }
            }}
          >
            <input name="side" placeholder="server or client" />
            <input type="submit" value="getManifest" />
          </form>
          {#if manifest.length > 0}
            <div style="white-space: pre;">
              {manifest.join('\n')}
            </div>
          {/if}
          <form
            onsubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const response = await fetch('/game-loader?/getBuildFile', {
                method: 'POST',
                body: JSON.stringify({
                  side: formData.get('side'),
                  filePath: formData.get('filePath'),
                }),
              });
              const result = deserialize(await response.text());
              if (result.type === 'success' && result.data) {
                buildFile = result.data.fileContent;
              }
            }}
          >
            <input name="side" placeholder="server or client" />
            <input name="filePath" placeholder="Manifest file path" />
            <input type="submit" value="getManifest" />
          </form>
          {#if buildFile}
            <div style="white-space: pre;">
              {buildFile}
            </div>
          {/if}
          <form
            onsubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const response = await fetch('/game-loader?/getComponentManifest', {
                method: 'POST',
                body: JSON.stringify({
                  side: formData.get('side'),
                  componentPath: formData.get('componentPath'),
                }),
              });
              const result = deserialize(await response.text());
              if (result.type === 'success' && result.data) {
                componentManifest = result.data.manifest;
              }
            }}
          >
            <input name="side" placeholder="server or client" />
            <input name="componentPath" placeholder="Component file path" />
            <input type="submit" value="getManifest" />
          </form>
          {#if componentManifest}
            <div style="white-space: pre;">
              {JSON.stringify(componentManifest)}
            </div>
          {/if}
          <form
            onsubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const response = await fetch('/game-loader?/getSave', {
                method: 'POST',
                body: JSON.stringify({ side: formData.get('side') }),
              });
              const result = deserialize(await response.text());
              if (result.type === 'success' && result.data) {
                save = result.data.save;
              }
            }}
          >
            <input name="side" placeholder="server or client" />
            <input type="submit" value="getSave" />
          </form>
          {#if save}
            <div style="white-space: pre;">
              {JSON.stringify(save)}
            </div>
          {/if}
          <form
            onsubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const response = await fetch('/game-loader?/getEnv', {
                method: 'POST',
                body: formData,
              });
              const result = deserialize(await response.text());
              if (result.type === 'success' && result.data) {
                env = result.data.env;
              }
            }}
          >
            <input type="submit" value="getEnv" />
          </form>
          {#if env}
            <div style="white-space: pre;">
              {JSON.stringify(env)}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </header>
</div>
