<script lang="ts">
  import {
    EditorServices,
    RuntimeServiceToken,
    SettingsServiceToken,
  } from '@nanoforge-dev/editor-sdk';
  import {
    Button,
    EmptyState,
    Icon,
    IconButton,
    Menu,
    type MenuEntry,
    VIEWPORT_OVERLAYS,
    type WidgetInstance,
  } from '@nanoforge-dev/editor-sdk/ui';

  import StatsOverlay from './StatsOverlay.svelte';
  import ViewportToolbar from '../ViewportToolbar.svelte';
  import { popout } from '../../game/popout';
  import { RESOLUTIONS, frameSize } from '../../game/resolutions';
  import { SETTING } from '../../settings/viewport-settings.const';

  const { instance }: { instance: WidgetInstance } = $props();
  // svelte-ignore state_referenced_locally
  const { services } = instance;
  const runtime = services.tryGet(RuntimeServiceToken);
  const commands = services.get(EditorServices.Commands);
  const extensions = services.get(EditorServices.Extensions);
  const settings = services.get(SettingsServiceToken);
  const session = runtime?.session;
  const overlays = extensions.observe(VIEWPORT_OVERLAYS);

  const resolution = settings.observe<string>(SETTING.resolution);
  const orientation = settings.observe<'landscape' | 'portrait'>(SETTING.orientation);
  const zoom = settings.observe<number>(SETTING.zoom);
  const pixelPerfect = settings.observe<boolean>(SETTING.pixelPerfect);
  const stats = settings.observe<boolean>(SETTING.stats);

  let host = $state<HTMLElement>();
  let frame = $state<HTMLElement>();
  /** Compatibility warnings the user closed during this play session. */
  let dismissed = $state(false);
  const warnings = $derived(
    ($session?.compatibility ?? []).flatMap((check) => (check.message ? [check.message] : [])),
  );
  const size = $derived(frameSize($resolution ?? 'fit', $orientation ?? 'landscape', $zoom ?? 1));
  const playing = $derived($session?.state === 'running' || $session?.state === 'paused');

  $effect(() => {
    if (!runtime || !host || $popout) return;
    const view = runtime.attach(host);
    return () => view.dispose();
  });

  let previous: string | undefined;
  $effect(() => {
    const state = $session?.state;
    if (state === 'building') dismissed = false;
    if (state === 'running' && previous === 'starting') frame?.focus();
    previous = state;
  });

  const run = (command: string, ...args: unknown[]) => void commands.execute(command, ...args);
  const PROGRESS: Record<string, string> = {
    building: 'Building the game…',
    starting: 'Starting the game…',
    stopping: 'Stopping the game…',
  };

  const resolutions = (): MenuEntry[] => [
    {
      kind: 'item',
      id: 'fit',
      label: 'Fit to screen',
      checked: $resolution === 'fit',
      onSelect: () => run('viewport.setResolution', 'fit'),
    },
    { kind: 'separator' },
    ...RESOLUTIONS.map((preset): MenuEntry => ({
      kind: 'item',
      id: preset.id,
      label: preset.label,
      checked: $resolution === preset.id,
      onSelect: () => run('viewport.setResolution', preset.id),
    })),
    { kind: 'separator' },
    {
      kind: 'item',
      id: 'custom',
      label: 'Custom size…',
      checked: /^\d+x\d+$/.test($resolution ?? ''),
      onSelect: () => run('viewport.customResolution'),
    },
  ];
  const resolutionLabel = $derived(
    $resolution === 'fit'
      ? 'Fit'
      : (RESOLUTIONS.find((preset) => preset.id === $resolution)?.label.split(' (')[0] ??
          $resolution?.replace('x', ' × ')),
  );
</script>

<div class="screen" data-state={$session?.state ?? 'unavailable'}>
  <ViewportToolbar screen="game" {services}>
    {#snippet start()}
      <Menu items={resolutions()}>
        {#snippet trigger({ props })}
          <button {...props} type="button" class="resolution" aria-label="Resolution">
            <Icon name="monitor" size={14} />{resolutionLabel}<Icon name="chevron-down" size={12} />
          </button>
        {/snippet}
      </Menu>
      {#if $resolution !== 'fit'}
        <IconButton
          icon="rotate-cw"
          label="Rotate (portrait/landscape)"
          pressed={$orientation === 'portrait'}
          onclick={() => run('viewport.rotate')}
        />
        <IconButton icon="minus" label="Zoom out" onclick={() => run('viewport.zoomOut')} />
        <button
          type="button"
          class="zoom"
          title="Reset zoom"
          onclick={() => run('viewport.resetZoom')}
        >
          {Math.round(($zoom ?? 1) * 100)}%
        </button>
        <IconButton icon="plus" label="Zoom in" onclick={() => run('viewport.zoomIn')} />
      {/if}
    {/snippet}
  </ViewportToolbar>

  <div class="area">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class="frame"
      class:fit={!size}
      class:pixelated={$pixelPerfect}
      style:width={size ? `${size.width}px` : undefined}
      style:height={size ? `${size.height}px` : undefined}
      bind:this={frame}
      tabindex="0"
      role="application"
      aria-label="Running game"
      onkeydown={(event) => {
        if (event.key === 'Escape') (event.currentTarget as HTMLElement).blur();
      }}
    >
      <div class="host" bind:this={host}></div>
      {#if $session?.state === 'paused'}
        <div class="dim" aria-hidden="true"></div>
        <p class="badge" role="status"><Icon name="pause" size={14} />Paused</p>
      {/if}
      {#if playing && !$popout}
        {#each $overlays.filter((overlay) => overlay.value.screen === 'game') as overlay (overlay.value.id)}
          {@const Overlay = overlay.value.component}
          <Overlay />
        {/each}
        {#if $stats && runtime}<StatsOverlay {runtime} />{/if}
      {/if}
    </div>

    {#if $popout && playing}
      <div class="overlay">
        <EmptyState
          icon="external-link"
          title="The game runs in another window"
          description="Close that window, or bring it back here."
        >
          {#snippet actions()}
            <Button onclick={() => run('viewport.popOut')}>Show the window</Button>
            <Button variant="primary" onclick={() => run('viewport.bringBack')}
              >Bring it back</Button
            >
          {/snippet}
        </EmptyState>
      </div>
    {:else if !runtime}
      <div class="overlay">
        <EmptyState
          icon="gamepad-2"
          title="Games run from a local editor"
          description="Open this project with nf editor on your machine to play it."
        />
      </div>
    {:else if $session?.state === 'idle'}
      <div class="overlay">
        <EmptyState
          icon="gamepad-2"
          title="Play your game here"
          description="Play builds the game, starts its server in the background and runs the client in this screen."
        >
          {#snippet actions()}
            <Button variant="primary" icon="play" onclick={() => run('runtime.play')}>Play</Button>
          {/snippet}
        </EmptyState>
      </div>
    {:else if $session && PROGRESS[$session.state]}
      <div class="overlay" role="status">
        <p class="progress"><Icon name="loader-circle" size={16} />{PROGRESS[$session.state]}</p>
      </div>
    {:else if $session?.state === 'crashed'}
      <div class="overlay">
        <EmptyState icon="circle-alert" title={$session.error ?? 'The game stopped'}>
          {#snippet actions()}
            {#if $session.diagnostics?.length}
              <ul class="diagnostics">
                {#each $session.diagnostics.slice(0, 5) as diagnostic, index (index)}
                  <li>
                    {#if diagnostic.path}
                      <code>{diagnostic.path}{diagnostic.line ? `:${diagnostic.line}` : ''}</code>
                    {/if}
                    {diagnostic.message}
                  </li>
                {/each}
              </ul>
            {/if}
            <div class="buttons">
              <Button variant="primary" icon="rotate-ccw" onclick={() => run('runtime.restart')}>
                Try again
              </Button>
              {#if commands.has('console.show')}
                <Button icon="square-terminal" onclick={() => run('console.show')}
                  >Show the console</Button
                >
              {/if}
              <Button onclick={() => run('runtime.stop')}>Dismiss</Button>
            </div>
          {/snippet}
        </EmptyState>
      </div>
    {:else if $session?.mode === 'server'}
      <div class="overlay">
        <EmptyState
          icon="server"
          title={$session.state === 'paused'
            ? 'The game server is paused'
            : 'The game server is running'}
          description="Its output is in the Output panel. Play with a client to see the game here."
        />
      </div>
    {/if}

    {#if warnings.length && !dismissed && playing}
      <div class="warning" role="alert">
        <Icon name="triangle-alert" size={16} />
        <div>
          {#each warnings as warning (warning)}<p>{warning}</p>{/each}
        </div>
        <IconButton icon="x" label="Dismiss" onclick={() => (dismissed = true)} />
      </div>
    {/if}
  </div>
</div>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--nf-color-bg);
  }
  .resolution,
  .zoom {
    display: inline-flex;
    gap: var(--nf-space-1);
    align-items: center;
    height: 26px;
    padding: 0 var(--nf-space-2);
    border: 0;
    border-radius: var(--nf-radius-control);
    background: transparent;
    color: var(--nf-color-text);
    font: inherit;
    font-size: var(--nf-font-size-sm);
    cursor: pointer;
  }
  .resolution:hover,
  .zoom:hover {
    background: var(--nf-color-hover);
  }
  .zoom {
    min-width: 48px;
    justify-content: center;
    color: var(--nf-color-text-muted);
  }
  .area {
    position: relative;
    display: grid;
    flex: 1;
    min-height: 0;
    place-items: center;
    overflow: auto;
    background: repeating-conic-gradient(var(--nf-color-sunken) 0 25%, var(--nf-color-bg) 0 50%) 0
      0 / 16px 16px;
  }
  .frame {
    position: relative;
    flex: none;
    background: #000;
    box-shadow: 0 0 0 1px var(--nf-color-border);
    outline: none;
  }
  .frame:focus-visible {
    box-shadow: 0 0 0 2px var(--nf-color-focus);
  }
  .frame.fit {
    position: absolute;
    inset: 0;
    box-shadow: none;
  }
  .frame.pixelated :global(canvas) {
    image-rendering: pixelated;
  }
  .host {
    position: absolute;
    inset: 0;
  }
  .screen:not([data-state='running'], [data-state='paused']) .frame {
    visibility: hidden;
  }
  .dim {
    position: absolute;
    inset: 0;
    background: rgb(0 0 0 / 45%);
    pointer-events: none;
  }
  .badge {
    position: absolute;
    top: var(--nf-space-2);
    right: var(--nf-space-2);
    display: flex;
    gap: var(--nf-space-1);
    align-items: center;
    margin: 0;
    padding: var(--nf-space-1) var(--nf-space-2);
    border-radius: var(--nf-radius-float);
    background: var(--nf-color-surface);
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: var(--nf-color-bg);
  }
  .progress {
    display: flex;
    gap: var(--nf-space-2);
    align-items: center;
    margin: 0;
    color: var(--nf-color-text-muted);
  }
  .progress :global(svg) {
    animation: spin 1s linear infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .progress :global(svg) {
      animation: none;
    }
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .diagnostics {
    max-width: 640px;
    margin: 0 0 var(--nf-space-2);
    padding: 0;
    list-style: none;
    font-size: var(--nf-font-size-sm);
    text-align: left;
  }
  .diagnostics li {
    margin-bottom: var(--nf-space-1);
  }
  .diagnostics code {
    margin-right: var(--nf-space-2);
    color: var(--nf-color-danger);
  }
  .buttons {
    display: flex;
    gap: var(--nf-space-2);
    justify-content: center;
  }
  .warning {
    position: absolute;
    top: var(--nf-space-2);
    left: 50%;
    display: flex;
    gap: var(--nf-space-2);
    align-items: flex-start;
    max-width: min(640px, calc(100% - 2 * var(--nf-space-3)));
    padding: var(--nf-space-2) var(--nf-space-2) var(--nf-space-2) var(--nf-space-3);
    border: 1px solid var(--nf-color-warning);
    border-radius: var(--nf-radius-float);
    background: var(--nf-color-surface);
    font-size: var(--nf-font-size-sm);
    transform: translateX(-50%);
  }
  .warning > :global(svg) {
    flex: none;
    margin-top: 2px;
    color: var(--nf-color-warning);
  }
  .warning p {
    margin: 0;
  }
  .warning p + p {
    margin-top: var(--nf-space-1);
  }
</style>
