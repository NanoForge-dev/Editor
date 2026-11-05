import {
  EditorServices,
  HistoryServiceToken,
  defineExtensionPoint,
  definePlugin,
  observe,
} from '@nanoforge-dev/editor-sdk';
import { FILE_TEMPLATES, NotificationServiceToken } from '@nanoforge-dev/editor-sdk/ui';

/** Extension points of the ECS plugin: a plugin contributes to another's points by their id. */
const ENTITY_ACTIONS = defineExtensionPoint<{
  id: string;
  title: string;
  command: string;
  when?: string;
}>('ecs.entityActions');
const PARAM_PRESETS = defineExtensionPoint<{
  id: string;
  title: string;
  slots?: string[];
  required?: string[];
  types: string[];
}>('ecs.paramPresets');

export default definePlugin({
  activate(context) {
    context.registerMessages('en', { greeting: 'Hello from {name}!' });
    context.registerMessages('fr', { greeting: 'Bonjour de {name} !' });
    context.registerCommand('hello.greet', () => context.t('greeting', { name: context.name }));
    const history = context.services.get(HistoryServiceToken);
    const hello = history.registerContext({ id: 'hello', label: 'Hello', owner: context.name });
    context.subscriptions.add(hello);
    let greetings = 0;
    const greet = (label: string) => ({
      label,
      do: () => void greetings++,
      undo: () => void greetings--,
    });
    context.subscriptions.add(
      context.registerCommand('hello.twice', () =>
        hello.stack.transaction('Say hello twice', async (tx) => {
          await tx.push(greet('Hello'));
          await tx.push(greet('Hello again'));
        }),
      ),
    );
    context.subscriptions.add(
      context.registerCommand('hello.log', () => {
        context.logger.info('Hello state', { greetings, nested: { deep: true, list: [1, 2] } });
        context.logger.warn('Careful with greetings');
        for (let index = 0; index < 3; index++) context.logger.info('tick');
        context.logger.debug('A quiet detail');
        context.logger.info('Edit apps/client/src/main.ts:3:1 to say more');
      }),
    );
    context.subscriptions.add(
      context.contribute(FILE_TEMPLATES, {
        id: 'hello.greeting',
        title: 'Greeting',
        category: 'Hello',
        defaultName: 'greeting.txt',
        create: ({ name }) => [{ path: name, content: `Hello from ${name}!\n` }],
      }),
    );

    context.subscriptions.add(
      context.registerCommand('hello.greetEntity', (services, target?: { entity?: string }) =>
        services
          .tryGet(NotificationServiceToken)
          ?.notify('info', `Hello, ${target?.entity ?? 'nobody'}!`),
      ),
    );
    context.subscriptions.add(
      context.contribute(ENTITY_ACTIONS, {
        id: 'hello.greet-entity',
        title: 'Say hello to it',
        command: 'hello.greetEntity',
        when: 'ecsComponent:Position',
      }),
    );
    context.subscriptions.add(
      context.contribute(PARAM_PRESETS, {
        id: 'range',
        title: 'Range',
        slots: ['min', 'max'],
        required: ['min', 'max'],
        types: ['number'],
      }),
    );

    const bus = context.services.get(EditorServices.EventBus);
    context.subscriptions.add(
      observe(context.eligibleApps, (apps) => {
        context.logger.info(`Eligible apps: ${apps.map((app) => app.name).join(', ') || 'none'}`);
      }),
    );
    context.logger.info('Hello plugin activated', typeof bus.emit);
  },
});
