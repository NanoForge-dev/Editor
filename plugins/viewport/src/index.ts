import type { Component } from 'svelte';

import {
  DisposableStore,
  EditorServices,
  MutableDisposable,
  ProjectServiceToken,
  RuntimeServiceToken,
  SettingsServiceToken,
  definePlugin,
  observe,
} from '@nanoforge-dev/editor-sdk';
import {
  LayoutControllerToken,
  NotificationServiceToken,
  PromptServiceToken,
  StyleServiceToken,
  VIEWPORT_TOOLS,
  WIDGET_VIEWS,
  type WidgetInstance,
  registerIcons,
} from '@nanoforge-dev/editor-sdk/ui';

import { bringBack, popOut, popout } from './game/popout';
import { frameSize, stepZoom } from './game/resolutions';
import { captureGame, screenshotPath } from './game/screenshot';
import { ICONS } from './icons';
import { GAME_SCREEN, SCENE_SCREEN, SETTING } from './settings/viewport-settings.const';
import { TOGGLES, TOOLS } from './toolbar/viewport-tools.const';
import GameScreen from './widgets/game/GameScreen.svelte';
import SceneScreen from './widgets/scene/SceneScreen.svelte';

export default definePlugin({
  async activate(context) {
    const { services } = context;
    const css = await fetch(context.resolveAsset('viewport.css')).then((response) =>
      response.ok ? response.text() : '',
    );
    context.subscriptions.add(services.get(StyleServiceToken).inject(context.name, css));
    context.subscriptions.add(registerIcons(ICONS));
    for (const [id, component] of [
      [GAME_SCREEN, GameScreen],
      [SCENE_SCREEN, SceneScreen],
    ] as const) {
      context.subscriptions.add(
        context.contribute(WIDGET_VIEWS, {
          id,
          component: component as Component<{ instance: WidgetInstance }>,
        }),
      );
    }
    for (const tool of TOOLS) {
      context.subscriptions.add(context.contribute(VIEWPORT_TOOLS, { screen: 'game', ...tool }));
    }

    const settings = services.get(SettingsServiceToken);
    const contextKeys = services.get(EditorServices.ContextKeys);
    for (const [key, setting] of Object.entries(TOGGLES)) {
      context.subscriptions.add(
        observe(settings.observe<boolean>(setting), (value) => contextKeys.set(key, value)),
      );
    }
    const write = (key: string, value: unknown) =>
      settings.set(key, value, settings.hasStore('machine') ? 'machine' : 'account');
    const toggle = (key: string) => write(key, !settings.get<boolean>(key));
    const runtime = () => services.tryGet(RuntimeServiceToken);
    const notify = (kind: 'info' | 'error', title: string, detail?: string) =>
      services.tryGet(NotificationServiceToken)?.notify(kind, title, detail ? { detail } : {});

    const playing = context.subscriptions.add(new MutableDisposable<DisposableStore>());
    context.subscriptions.add({
      dispose: services.get(ProjectServiceToken).current.subscribe(() => {
        playing.clear();
        const service = runtime();
        if (!service) return;
        const store = new DisposableStore();
        let previousScreen: string | undefined;
        let previousState = service.session.get().state;
        store.add({
          dispose: service.session.subscribe(({ state, mode }) => {
            const layout = services.tryGet(LayoutControllerToken);
            const was = previousState;
            previousState = state;
            if (state === 'building' && (was === 'idle' || was === 'crashed')) {
              const active = layout?.current.activeScreen;
              if (mode !== 'server') {
                previousScreen = active && active !== GAME_SCREEN ? active : undefined;
                layout?.showScreen(GAME_SCREEN);
              }
              if (settings.get<boolean>(SETTING.maximizeOnPlay)) layout?.setDocksHidden(true);
            }
            if (state === 'running' && was === 'starting') {
              service.send('mute', [settings.get<boolean>(SETTING.muted)]);
            }
            if (state === 'crashed') layout?.setDocksHidden(false);
            if (state === 'idle' && was !== 'idle') {
              layout?.setDocksHidden(false);
              bringBack();
              if (previousScreen && layout?.current.activeScreen === GAME_SCREEN) {
                layout.showScreen(previousScreen);
              }
              previousScreen = undefined;
            }
          }),
        });
        store.add(
          observe(settings.observe<boolean>(SETTING.muted), (muted) => {
            if (['running', 'paused'].includes(service.session.get().state)) {
              service.send('mute', [muted]);
            }
          }),
        );
        playing.value = store;
      }),
    });

    const stageOf = () =>
      popout.get()?.document.querySelector<HTMLElement>('[data-nf-game-stage]') ??
      document.querySelector<HTMLElement>('[data-nf-game-stage]');

    const commands: [string, (...args: unknown[]) => unknown][] = [
      ['viewport.setResolution', (id) => typeof id === 'string' && write(SETTING.resolution, id)],
      [
        'viewport.customResolution',
        async () => {
          const value = await services.tryGet(PromptServiceToken)?.ask({
            title: 'Custom resolution',
            label: 'Width × height (e.g. 1600x900)',
            value: '1600x900',
            confirm: 'Apply',
            validate: (text) =>
              frameSize(
                text.replace(/\s|×/g, (char) => (char === '×' ? 'x' : '')),
                'landscape',
                1,
              )
                ? undefined
                : 'Use WIDTHxHEIGHT, e.g. 1600x900',
          });
          if (value) await write(SETTING.resolution, value.replace(/\s/g, '').replace('×', 'x'));
        },
      ],
      [
        'viewport.rotate',
        () =>
          write(
            SETTING.orientation,
            settings.get(SETTING.orientation) === 'portrait' ? 'landscape' : 'portrait',
          ),
      ],
      [
        'viewport.zoomIn',
        () =>
          write(
            SETTING.zoom,
            stepZoom(settings.get(SETTING.zoom), 1, settings.get(SETTING.pixelPerfect)),
          ),
      ],
      [
        'viewport.zoomOut',
        () =>
          write(
            SETTING.zoom,
            stepZoom(settings.get(SETTING.zoom), -1, settings.get(SETTING.pixelPerfect)),
          ),
      ],
      ['viewport.resetZoom', () => write(SETTING.zoom, 1)],
      [
        'viewport.togglePixelPerfect',
        async () => {
          await toggle(SETTING.pixelPerfect);
          const zoom = settings.get<number>(SETTING.zoom);
          if (settings.get(SETTING.pixelPerfect) && !Number.isInteger(zoom)) {
            await write(SETTING.zoom, Math.max(1, Math.round(zoom)));
          }
        },
      ],
      ['viewport.toggleStats', () => toggle(SETTING.stats)],
      ['viewport.toggleMute', () => toggle(SETTING.muted)],
      ['viewport.toggleMaximizeOnPlay', () => toggle(SETTING.maximizeOnPlay)],
      [
        'viewport.screenshot',
        async () => {
          const stage = stageOf();
          const project = services.get(ProjectServiceToken).current.get();
          const image = stage && (await captureGame(stage));
          if (!image || !project) {
            notify('info', 'Nothing to capture: play the game first');
            return;
          }
          const path = screenshotPath();
          await project.fs.write(path, new Uint8Array(await image.arrayBuffer()));
          await navigator.clipboard
            ?.write([new ClipboardItem({ 'image/png': image })])
            .catch(() => undefined);
          notify('info', 'Screenshot saved', path);
        },
      ],
      [
        'viewport.popOut',
        () => {
          const service = runtime();
          if (service && !popOut(service, 'NanoForge game')) {
            notify('error', 'The browser blocked the new window', 'Allow pop-ups for the editor.');
          }
        },
      ],
      ['viewport.bringBack', () => bringBack()],
    ];
    for (const [id, run] of commands) {
      context.subscriptions.add(
        context.registerCommand(id, (_services, ...args: unknown[]) => run(...args)),
      );
    }
    context.subscriptions.add({ dispose: () => bringBack() });
  },
});
