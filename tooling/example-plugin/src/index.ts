import {
  EditorServices,
  HistoryServiceToken,
  definePlugin,
  observe,
} from '@nanoforge-dev/editor-sdk';
import { FILE_TEMPLATES } from '@nanoforge-dev/editor-sdk/ui';

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

    const bus = context.services.get(EditorServices.EventBus);
    context.subscriptions.add(
      observe(context.eligibleApps, (apps) => {
        context.logger.info(`Eligible apps: ${apps.map((app) => app.name).join(', ') || 'none'}`);
      }),
    );
    context.logger.info('Hello plugin activated', typeof bus.emit);
  },
});
