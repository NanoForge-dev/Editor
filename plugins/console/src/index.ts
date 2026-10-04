import type { Component } from 'svelte';

import {
  CodeServiceToken,
  DiagnosticsServiceToken,
  EditorServices,
  MutableDisposable,
  ProjectServiceToken,
  SettingsServiceToken,
  definePlugin,
  derived,
  observe,
} from '@nanoforge-dev/editor-sdk';
import {
  STATUS_BAR_ITEMS,
  StyleServiceToken,
  WIDGET_VIEWS,
  type WidgetInstance,
  registerIcons,
} from '@nanoforge-dev/editor-sdk/ui';

import { ICONS } from './icons';
import { summary } from './problems/group-problems';
import { setConsoleStore } from './session/console-session';
import { ConsoleStore } from './store/console-store';
import ConsoleView from './widgets/console/ConsoleView.svelte';
import ProblemsView from './widgets/problems/ProblemsView.svelte';

const CONSOLE = 'console.console';
const PROBLEMS = 'console.problems';
const MAX_LINES = '@nanoforge/console.maxLines';
const CHECK_PROJECT = '@nanoforge/console.checkWholeProject';
/** The first check waits for the project to settle: it starts the code worker. */
const CHECK_DELAY_MS = 1500;

export default definePlugin({
  async activate(context) {
    const { services } = context;
    const css = await fetch(context.resolveAsset('console.css')).then((response) =>
      response.ok ? response.text() : '',
    );
    context.subscriptions.add(services.get(StyleServiceToken).inject(context.name, css));
    context.subscriptions.add(registerIcons(ICONS));

    const settings = services.get(SettingsServiceToken);
    const store = new ConsoleStore(
      services.get(EditorServices.Logger),
      () => settings.get<number>(MAX_LINES) ?? 2000,
    );
    setConsoleStore(store);
    context.subscriptions.add(store);
    context.subscriptions.add({ dispose: () => setConsoleStore(undefined) });

    for (const [id, component] of [
      [CONSOLE, ConsoleView],
      [PROBLEMS, ProblemsView],
    ] as const) {
      context.subscriptions.add(
        context.contribute(WIDGET_VIEWS, {
          id,
          component: component as Component<{ instance: WidgetInstance }>,
        }),
      );
    }

    const commands = services.get(EditorServices.Commands);
    const show = (widget: string) => commands.execute('workbench.openWidget', widget);
    context.subscriptions.add(context.registerCommand('console.show', () => show(CONSOLE)));
    context.subscriptions.add(context.registerCommand('console.clear', () => store.clear()));
    context.subscriptions.add(
      context.registerCommand('console.showProblems', () => show(PROBLEMS)),
    );

    const diagnostics = services.get(DiagnosticsServiceToken);
    context.subscriptions.add(
      context.contribute(STATUS_BAR_ITEMS, {
        id: 'console.problems',
        alignment: 'left',
        order: 5,
        text: derived([diagnostics.all], summary),
        tooltip: 'Show problems',
        command: 'console.showProblems',
      }),
    );

    const check = context.subscriptions.add(new MutableDisposable());
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      clearTimeout(timer);
      check.clear();
      if (!settings.get<boolean>(CHECK_PROJECT)) return;
      timer = setTimeout(() => {
        const code = services.tryGet(CodeServiceToken);
        if (code) check.value = code.checkProject();
      }, CHECK_DELAY_MS);
    };
    context.subscriptions.add({ dispose: () => clearTimeout(timer) });
    context.subscriptions.add(observe(settings.observe<boolean>(CHECK_PROJECT), sync));
    context.subscriptions.add({
      dispose: services.get(ProjectServiceToken).current.subscribe(sync),
    });
  },
});
