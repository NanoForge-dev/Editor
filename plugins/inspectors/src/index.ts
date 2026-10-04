import type { Component } from 'svelte';

import {
  MutableDisposable,
  ProjectServiceToken,
  RuntimeServiceToken,
  definePlugin,
} from '@nanoforge-dev/editor-sdk';
import {
  StyleServiceToken,
  WIDGET_VIEWS,
  type WidgetInstance,
  registerIcons,
} from '@nanoforge-dev/editor-sdk/ui';

import { ICONS } from './icons';
import { Recorder } from './recorder/recorder';
import { setRecorder } from './session/recorder-session';
import NetworkView from './widgets/network/NetworkView.svelte';
import ProfilerView from './widgets/profiler/ProfilerView.svelte';
import WorldView from './widgets/world/WorldView.svelte';

export default definePlugin({
  async activate(context) {
    const { services } = context;
    const css = await fetch(context.resolveAsset('inspectors.css')).then((response) =>
      response.ok ? response.text() : '',
    );
    context.subscriptions.add(services.get(StyleServiceToken).inject(context.name, css));
    context.subscriptions.add(registerIcons(ICONS));

    const recorder = new Recorder();
    setRecorder(recorder);
    context.subscriptions.add(recorder);
    context.subscriptions.add({ dispose: () => setRecorder(undefined) });

    const session = context.subscriptions.add(new MutableDisposable());
    const followRuntime = () => {
      const runtime = services.tryGet(RuntimeServiceToken);
      recorder.reset();
      recorder.setRuntime(runtime);
      let previous = runtime?.session.get().state;
      const unsubscribe = runtime?.session.subscribe(({ state }) => {
        if (state === 'building' && previous !== 'building') recorder.reset();
        previous = state;
      });
      session.value = { dispose: () => unsubscribe?.() };
    };
    context.subscriptions.add({
      dispose: services
        .get(ProjectServiceToken)
        .current.subscribe(() => queueMicrotask(followRuntime)),
    });

    for (const [id, component] of [
      ['inspectors.profiler', ProfilerView],
      ['inspectors.network', NetworkView],
      ['inspectors.world', WorldView],
    ] as const) {
      context.subscriptions.add(
        context.contribute(WIDGET_VIEWS, {
          id,
          component: component as Component<{ instance: WidgetInstance }>,
        }),
      );
    }
  },
});
