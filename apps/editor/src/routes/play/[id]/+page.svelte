<script lang="ts">
  import { page } from '$app/state';

  import { RuntimeContract } from '@nanoforge-dev/editor-protocol';
  import { RpcClient } from '@nanoforge-dev/editor-rpc';
  import { type GameClientModule, GameClientRunner } from '@nanoforge-dev/editor-runtime';

  import { errorMessage } from '$lib/editor/error-description';

  /**
   * Another client of the game played in the editor (multiplayer tests): the last build of the
   * app, full page. Environment overrides come in the URL fragment (never sent to the server).
   */
  const project = $derived(page.params.id ?? '');
  const app = $derived(page.url.searchParams.get('app') ?? '');
  let host = $state<HTMLElement>();
  let error = $state<string>();

  const overrides = (): Record<string, string> => {
    try {
      const encoded = new URLSearchParams(location.hash.slice(1)).get('env');
      return encoded ? (JSON.parse(atob(encoded)) as Record<string, string>) : {};
    } catch {
      return {};
    }
  };

  $effect(() => {
    if (!host) return;
    const rpc = new RpcClient({ baseUrl: location.origin });
    const runtime = rpc.api(RuntimeContract);
    const runner = new GameClientRunner({
      importModule: (url) => import(/* @vite-ignore */ url) as Promise<GameClientModule>,
      onEvent: () => undefined,
      onError: (reason) => console.error(reason),
    });
    const target = host;
    Promise.all([
      runtime.manifest({ project, app }),
      runtime.env({ project, app, overrides: overrides() }),
    ])
      .then(([manifest, env]) =>
        runner.start({ host: target, manifest, env, origin: location.origin }),
      )
      .catch((reason: unknown) => (error = errorMessage(reason)));
    return () => {
      void runner.stop(500);
      rpc.dispose();
    };
  });
</script>

<svelte:head>
  <title>{app ? `${app.split('/').at(-1)} · ` : ''}NanoForge game</title>
</svelte:head>

<main bind:this={host}>
  {#if error}
    <p class="error" role="alert">
      Could not start the game: {error}. Build it from the editor (Play), then reload this page.
    </p>
  {/if}
</main>

<style>
  main {
    position: fixed;
    inset: 0;
    overflow: hidden;
  }
  .error {
    max-width: 560px;
    margin: 20vh auto 0;
    padding: 0 16px;
  }
</style>
