<script lang="ts">
  import { CoreSettings } from '@nanoforge-dev/editor-settings';
  import { Button } from '@nanoforge-dev/editor-ui';

  import { getEditor } from '$lib/editor/editor-context';

  /**
   * The home page's welcome, until put away (`welcome.show`) or the tutorial's project opened: a
   * local editor offers the tutorial on a project of its own, a hosted one says where the tour is.
   */
  const { disabled, onstart }: { disabled: boolean; onstart: () => Promise<boolean> } = $props();

  const editor = getEditor();
  const local = editor.session.mode === 'OFFLINE';
  const shown = editor.settings.observe(CoreSettings.welcomeShow);

  const hide = () =>
    void editor.settings
      .set(CoreSettings.welcomeShow, false, editor.settings.hasStore('account') ? 'account' : 'machine')
      .catch(() => undefined);
</script>

{#if $shown}
  <section class="welcome" aria-labelledby="welcome-title">
    <h2 id="welcome-title">Welcome to NanoForge</h2>
    {#if local}
      <p>
        New here? The tutorial makes a small game, my-first-game, and walks you through it: add an
        entity, change a value, fix a mistake, play it and save it in git. About ten minutes.
      </p>
      <div class="buttons">
        <Button
          variant="primary"
          {disabled}
          onclick={async () => {
            if (await onstart()) hide();
          }}>Start the tutorial</Button
        >
        <Button variant="ghost" onclick={hide}>Not now</Button>
      </div>
    {:else}
      <p>New here? Open one of your projects, then Help › Tutorial takes you around the editor.</p>
      <div class="buttons">
        <Button variant="ghost" onclick={hide}>Got it</Button>
      </div>
    {/if}
    <p class="muted">Help › Tutorial plays it again at any time.</p>
  </section>
{/if}

<style>
  .welcome {
    padding: var(--nf-space-4);
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-float);
    background: var(--nf-color-surface);
  }
  h2 {
    margin-top: 0;
  }
  .buttons {
    display: flex;
    gap: var(--nf-space-2);
  }
  .muted {
    margin-bottom: 0;
    color: var(--nf-color-text-muted);
  }
</style>
