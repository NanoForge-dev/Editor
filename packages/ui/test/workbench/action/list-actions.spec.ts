import { describe, expect, it } from 'vitest';

import {
  COMMAND_METADATA,
  CommandRegistry,
  Container,
  ContextKeyService,
  ExtensionRegistry,
} from '@nanoforge-dev/editor-kernel';

import {
  actionLabel,
  isActionEnabled,
  listActions,
} from '../../../src/workbench/action/list-actions';
import {
  MENU_BAR,
  MENU_ITEMS,
  MenuItemSchema,
} from '../../../src/workbench/extension-point/menu.extension-point';

const setup = () => {
  const extensions = new ExtensionRegistry();
  const context = new ContextKeyService();
  const commands = new CommandRegistry(new Container(), context);
  const noop = () => undefined;
  commands.register({
    id: 'runtime.stop',
    title: 'Stop',
    category: 'Run',
    when: 'playing',
    handler: noop,
  });
  commands.register({ id: 'open.widget', title: 'Open panel', palette: false, handler: noop });
  commands.register({ id: 'internal', handler: noop });
  commands.register({ id: 'hello.greet', handler: noop });
  const declare = (id: string, title: string, extra = {}) =>
    extensions.contribute(
      COMMAND_METADATA,
      { id, title, owner: '@acme/hello', ...extra },
      { owner: 'x' },
    );
  declare('hello.greet', 'Say hello', { category: 'Hello' });
  declare('hello.lazy', 'Lazy one');
  extensions.contribute(MENU_BAR, { id: 'view', title: 'View', order: 0 }, { owner: 'core' });
  const item = (value: Record<string, unknown>) =>
    extensions.contribute(MENU_ITEMS, MenuItemSchema.parse(value), { owner: 'core' });
  item({ menu: 'view', submenu: 'view.panels', title: 'Panels' });
  item({ menu: 'view.panels', command: 'open.widget', args: ['console'], title: 'Console' });
  item({
    menu: 'view.panels',
    command: 'open.widget',
    args: ['files'],
    title: 'Files',
    when: 'project',
  });
  item({ menu: 'view', command: 'runtime.stop' });
  item({ menu: 'tab/context', command: 'open.widget', args: ['x'], title: 'Context only' });
  return { actions: listActions({ commands, extensions }), context };
};

describe('listActions', () => {
  it('lists titled commands and menu entries with arguments', () => {
    const { actions } = setup();
    expect(actions.map((action) => [action.id, actionLabel(action)])).toEqual([
      ['hello.greet', 'Hello: Say hello'],
      ['hello.lazy', 'Lazy one'],
      ['runtime.stop', 'Run: Stop'],
      ['open.widget ["console"]', 'View › Panels: Console'],
      ['open.widget ["files"]', 'View › Panels: Files'],
    ]);
  });

  it('tells which actions can run now', () => {
    const { actions, context } = setup();
    const enabled = () =>
      actions.filter((action) => isActionEnabled(action, context)).map((action) => action.id);
    expect(enabled()).toEqual(['hello.greet', 'hello.lazy', 'open.widget ["console"]']);
    context.set('playing', true);
    context.set('project', true);
    expect(enabled()).toHaveLength(5);
  });
});
