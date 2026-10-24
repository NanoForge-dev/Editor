import type { Component } from 'svelte';

import { HistoryServiceToken, SettingsServiceToken, definePlugin } from '@nanoforge-dev/editor-sdk';
import { StyleServiceToken, WIDGET_VIEWS, type WidgetInstance } from '@nanoforge-dev/editor-sdk/ui';

import Panel from './Panel.svelte';
import { count } from './counter';

/** Undo and redo target of the panel (see Panel.svelte). */
export const HISTORY = 'counter';

export default definePlugin({
  async activate(context) {
    const { services } = context;

    // The panel's styles are built into counter.css: the plugin injects them when it starts.
    const css = await fetch(context.resolveAsset('counter.css')).then((response) =>
      response.ok ? response.text() : '',
    );
    context.subscriptions.add(services.get(StyleServiceToken).inject(context.name, css));

    // The view of the widget declared in the manifest.
    context.subscriptions.add(
      context.contribute(WIDGET_VIEWS, {
        id: 'counter.panel',
        component: Panel as Component<{ instance: WidgetInstance }>,
      }),
    );

    // A history of its own: each addition can be undone with Ctrl+Z while the panel has focus.
    const history = services.get(HistoryServiceToken).registerContext({
      id: HISTORY,
      label: 'Counter',
      owner: context.name,
    });
    context.subscriptions.add(history);

    // The command declared in the manifest. Settings keys carry the plugin's name.
    const settings = services.get(SettingsServiceToken);
    context.subscriptions.add(
      context.registerCommand('counter.add', async () => {
        const step = Number(settings.get('@acme/counter.step')) || 1;
        await history.stack.push({
          label: `Add ${step}`,
          do: () => count.set(count.get() + step),
          undo: () => count.set(count.get() - step),
        });
        context.logger.info(`Counter: ${count.get()}`);
      }),
    );
  },
});
