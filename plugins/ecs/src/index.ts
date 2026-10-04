import Move from '@lucide/svelte/icons/move';
import type { Component } from 'svelte';

import {
  type AppModel,
  CODEGEN_TARGETS,
  type CodegenTarget,
  EditorServices,
  type Observable,
  definePlugin,
  observe,
} from '@nanoforge-dev/editor-sdk';
import {
  CODE_EDITOR_SIDE_PANELS,
  SCENE_EDITORS,
  StyleServiceToken,
  VIEWPORT_OVERLAYS,
  VIEWPORT_TOOLS,
  WIDGET_VIEWS,
  type WidgetInstance,
  registerIcons,
} from '@nanoforge-dev/editor-sdk/ui';

import { LiveService, LiveServiceToken } from './live/live-service';
import { MOVE_IN_GAME_KEY, moveInGame } from './live/move-in-game';
import type { EntryModel, EntryOp } from './model/ecs-model.type';
import { ecsApps } from './service/ecs-data';
import { EcsService, EcsServiceToken } from './service/ecs-service';
import { setPanelServices } from './session/panel-services';
import Browser from './widgets/browser/Browser.svelte';
import ComponentPanel from './widgets/component-panel/ComponentPanel.svelte';
import Hierarchy from './widgets/hierarchy/Hierarchy.svelte';
import Inspector from './widgets/inspector/Inspector.svelte';
import GameMoveOverlay from './widgets/scene/GameMoveOverlay.svelte';
import SceneView from './widgets/scene/SceneView.svelte';
import Systems from './widgets/systems/Systems.svelte';

type WidgetComponent = Component<{ instance: WidgetInstance }>;

export default definePlugin({
  async activate(context) {
    const css = await fetch(context.resolveAsset('ecs.css')).then((response) =>
      response.ok ? response.text() : '',
    );
    context.subscriptions.add(context.services.get(StyleServiceToken).inject(context.name, css));

    const ecs = context.subscriptions.add(new EcsService(context));
    context.provide(EcsServiceToken, ecs);
    const live = context.subscriptions.add(new LiveService(context, ecs));
    context.provide(LiveServiceToken, live);

    const widgets: [string, WidgetComponent][] = [
      ['ecs.hierarchy', Hierarchy as WidgetComponent],
      ['ecs.inspector', Inspector as WidgetComponent],
      ['ecs.browser', Browser as WidgetComponent],
      ['ecs.systems', Systems as WidgetComponent],
    ];
    for (const [id, component] of widgets) context.contribute(WIDGET_VIEWS, { id, component });

    setPanelServices(context.services);
    context.subscriptions.add({ dispose: () => setPanelServices(undefined) });
    context.contribute(CODE_EDITOR_SIDE_PANELS, {
      id: 'ecs.component',
      title: 'Component',
      icon: 'blocks',
      appliesTo: (path) => ecs.componentsIn(path).length > 0,
      changes: ecs.catalogState,
      component: ComponentPanel as Component<{ path: string }>,
    });

    const target: CodegenTarget<EntryModel, EntryOp> = {
      id: 'ecs.entry-file',
      label: 'Entry file (main.ts)',
      priority: 0,
      appliesTo: (app: AppModel) => ecsApps({ apps: [app] } as never).length > 0,
      load: (app: AppModel): Observable<EntryModel | undefined> => {
        let current: EntryModel | undefined;
        return {
          get: () => current,
          subscribe: (run) =>
            ecs.model.subscribe(() => {
              void ecs.analyzeApp(app).then((model) => {
                current = model;
                run(model);
              });
            }),
        };
      },
      apply: (app: AppModel, op: EntryOp) => ecs.commandFor(app, op, `ECS: ${op.kind}`),
    };
    context.contribute(CODEGEN_TARGETS, target as CodegenTarget);

    context.contribute(SCENE_EDITORS, {
      id: 'ecs.scene-2d',
      title: '2D scene',
      targets: ['ecs.entry-file'],
      component: SceneView as Component<{ instance?: WidgetInstance }>,
    });

    context.subscriptions.add(registerIcons({ move: Move }));
    const contextKeys = context.services.get(EditorServices.ContextKeys);
    context.subscriptions.add(observe(moveInGame, (on) => contextKeys.set(MOVE_IN_GAME_KEY, on)));
    context.subscriptions.add({ dispose: () => moveInGame.set(false) });
    context.registerCommand('ecs.toggleMoveInGame', () => moveInGame.set(!moveInGame.get()), {
      title: 'Move entities in the game',
      category: 'ECS',
    });
    context.contribute(VIEWPORT_TOOLS, {
      id: 'ecs.moveInGame',
      screen: 'game',
      icon: 'move',
      title: 'Move entities',
      command: 'ecs.toggleMoveInGame',
      order: 5,
      toggled: MOVE_IN_GAME_KEY,
    });
    context.contribute(VIEWPORT_OVERLAYS, {
      id: 'ecs.moveInGame',
      screen: 'game',
      component: GameMoveOverlay as Component<Record<string, never>>,
    });

    context.registerCommand('ecs.addEntity', () => ecs.apply({ kind: 'addEntity' }, 'Add entity'), {
      title: 'Add entity',
      category: 'ECS',
    });
    context.registerCommand(
      'ecs.removeEntity',
      () => {
        const entity = ecs.selection.get();
        return entity ? ecs.apply({ kind: 'removeEntity', entity }, `Remove ${entity}`) : false;
      },
      { title: 'Remove selected entity', category: 'ECS' },
    );
  },
});
