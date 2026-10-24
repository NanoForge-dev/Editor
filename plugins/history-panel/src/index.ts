import type { Component } from 'svelte';

import { definePlugin } from '@nanoforge-dev/editor-sdk';
import { StyleServiceToken, WIDGET_VIEWS, type WidgetInstance } from '@nanoforge-dev/editor-sdk/ui';

import HistoryView from './widgets/history/HistoryView.svelte';

export default definePlugin({
  async activate(context) {
    const css = await fetch(context.resolveAsset('history-panel.css')).then((response) =>
      response.ok ? response.text() : '',
    );
    context.subscriptions.add(context.services.get(StyleServiceToken).inject(context.name, css));
    context.subscriptions.add(
      context.contribute(WIDGET_VIEWS, {
        id: 'history-panel.history',
        component: HistoryView as Component<{ instance: WidgetInstance }>,
      }),
    );
  },
});
