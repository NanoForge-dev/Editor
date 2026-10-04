import type { Component } from 'svelte';

import { definePlugin } from '@nanoforge-dev/editor-sdk';
import {
  PromptServiceToken,
  StyleServiceToken,
  WIDGET_VIEWS,
  type WidgetInstance,
  registerIcons,
} from '@nanoforge-dev/editor-sdk/ui';

import { ECS_SOURCES, type EcsSource } from './extension/ecs-source.extension-point';
import { ICONS } from './icons';
import { SceneLiveService, SceneLiveServiceToken } from './live/scene-live-service';
import { SceneService, SceneServiceToken, sceneApps } from './service/scene-service';
import { validateSceneName } from './template/scene-template';
import Scenes from './widgets/scenes/Scenes.svelte';
import Vars from './widgets/vars/Vars.svelte';

type WidgetComponent = Component<{ instance: WidgetInstance }>;

export default definePlugin({
  async activate(context) {
    const css = await fetch(context.resolveAsset('scene.css')).then((response) =>
      response.ok ? response.text() : '',
    );
    context.subscriptions.add(context.services.get(StyleServiceToken).inject(context.name, css));
    context.subscriptions.add(registerIcons(ICONS));

    const scenes = context.subscriptions.add(new SceneService(context));
    context.provide(SceneServiceToken, scenes);
    const live = context.subscriptions.add(new SceneLiveService(context));
    context.provide(SceneLiveServiceToken, live);

    context.contribute(WIDGET_VIEWS, { id: 'scene.scenes', component: Scenes as WidgetComponent });
    context.contribute(WIDGET_VIEWS, { id: 'scene.vars', component: Vars as WidgetComponent });

    const source: EcsSource = {
      id: 'scene.scenes',
      priority: 10,
      appliesTo: (app) => sceneApps({ apps: [app] } as never).length > 0,
      current: (app) => scenes.current(app),
      inherited: (app) => scenes.inherited(app),
      edit: (_app, location) =>
        scenes.select(location.scope?.kind === 'method' ? location.scope.class : undefined),
      locationOf: (app, id) => scenes.sceneLocation(app, id),
    };
    context.contribute(ECS_SOURCES, source);

    context.registerCommand(
      'scene.newScene',
      async () => {
        const prompts = context.services.tryGet(PromptServiceToken);
        const taken = (scenes.model.get()?.scenes ?? []).map((scene) => scene.className);
        const name = await prompts?.ask({
          title: 'New scene',
          label: 'Name',
          value: 'Level',
          confirm: 'Create',
          validate: (value) => validateSceneName(value, taken),
        });
        return name ? scenes.newScene(name) : false;
      },
      { title: 'New scene…', category: 'Scenes' },
    );
    context.registerCommand(
      'scene.edit',
      (className: unknown) => {
        if (typeof className !== 'string') return false;
        scenes.select(className);
        return true;
      },
      { title: 'Edit scene', category: 'Scenes', palette: false },
    );
  },
});
