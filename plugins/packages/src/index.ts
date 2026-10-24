import { definePlugin } from '@nanoforge-dev/editor-sdk';
import { StyleServiceToken } from '@nanoforge-dev/editor-sdk/ui';

import { closePackagesDialog, openPackagesDialog } from './dialogs/packages/open-packages-dialog';

export default definePlugin({
  async activate(context) {
    const { services } = context;
    const css = await fetch(context.resolveAsset('packages.css')).then((response) =>
      response.ok ? response.text() : '',
    );
    context.subscriptions.add(services.get(StyleServiceToken).inject(context.name, css));

    context.subscriptions.add({ dispose: closePackagesDialog });
    context.subscriptions.add(
      context.registerCommand('packages.open', (_services, tab?: unknown) =>
        openPackagesDialog(services, tab),
      ),
    );
  },
});
