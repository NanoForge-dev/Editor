import {
  AccountSyncToken,
  JSON_SCHEMAS,
  PluginHostToken,
  RpcClientToken,
  SettingsRegistryToken,
  SettingsServiceToken,
  definePlugin,
  jsonSchemaOf,
} from '@nanoforge-dev/editor-sdk';
import { NotificationServiceToken, StyleServiceToken } from '@nanoforge-dev/editor-sdk/ui';

import { closeSettingsDialog, openSettingsDialog } from './dialogs/settings/open-settings-dialog';
import { followAccountPlugins } from './marketplace/account-plugins';

export default definePlugin({
  async activate(context) {
    const { services } = context;
    const css = await fetch(context.resolveAsset('settings-ui.css')).then((response) =>
      response.ok ? response.text() : '',
    );
    context.subscriptions.add(services.get(StyleServiceToken).inject(context.name, css));

    context.subscriptions.add({ dispose: closeSettingsDialog });
    context.subscriptions.add(
      context.registerCommand('settings.open', (_services, page?: unknown) =>
        openSettingsDialog(services, page),
      ),
    );

    const registry = services.get(SettingsRegistryToken);
    context.subscriptions.add(
      context.contribute(JSON_SCHEMAS, {
        fileMatch: ['.nanoforge/editor/settings.json', '.nanoforge/editor/local.json'],
        schema: () => ({
          type: 'object',
          properties: Object.fromEntries(
            registry.getAll().map((definition) => [
              definition.key,
              {
                ...(jsonSchemaOf(definition) as object),
                ...((definition.title ?? definition.description) && {
                  description: [definition.title, definition.description]
                    .filter(Boolean)
                    .join(': '),
                }),
              },
            ]),
          ),
        }),
      }),
    );

    const host = services.tryGet(PluginHostToken);
    const notifications = services.tryGet(NotificationServiceToken);
    if (host && notifications) {
      context.subscriptions.add(
        followAccountPlugins({
          rpc: services.get(RpcClientToken),
          settings: services.get(SettingsServiceToken),
          host,
          notifications,
        }),
      );
    }

    const account = services.tryGet(AccountSyncToken);
    if (account) {
      let known = 0;
      context.subscriptions.add({
        dispose: account.conflicts.subscribe((conflicts) => {
          if (conflicts.length > known) {
            services
              .tryGet(NotificationServiceToken)
              ?.notify('warning', 'Some settings conflict with your account', {
                detail: 'Open Settings › Sync conflicts to choose which values to keep.',
              });
          }
          known = conflicts.length;
        }),
      });
    }
  },
});
