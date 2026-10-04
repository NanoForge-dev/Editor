import type { Component } from 'svelte';

import {
  CodeServiceToken,
  DiagnosticsServiceToken,
  DocumentServiceToken,
  EditorServices,
  JSON_SCHEMAS,
  type JsonSchemaContribution,
  ProjectServiceToken,
  SettingsServiceToken,
  definePlugin,
  observe,
} from '@nanoforge-dev/editor-sdk';
import {
  CODE_EDITOR_ACTIVE_FILE,
  NotificationServiceToken,
  StyleServiceToken,
  ThemeServiceToken,
  WIDGET_VIEWS,
  type WidgetInstance,
} from '@nanoforge-dev/editor-sdk/ui';

import { setupMonaco } from './monaco/monaco';
import { CodeEditorService } from './service/code-editor-service';
import type { Comparison, OpenOptions } from './service/code-editor.type';
import { current } from './session/code-editor-session';
import ScriptScreen from './widgets/script/ScriptScreen.svelte';

export const SCRIPT_SCREEN = 'code-editor.script';

export default definePlugin({
  async activate(context) {
    const monaco = setupMonaco();
    const { services } = context;

    const css = await fetch(context.resolveAsset('code-editor.css')).then((response) =>
      response.ok ? response.text() : '',
    );
    context.subscriptions.add(services.get(StyleServiceToken).inject(context.name, css));

    context.subscriptions.add(
      context.contribute(WIDGET_VIEWS, {
        id: SCRIPT_SCREEN,
        component: ScriptScreen as Component<{ instance: WidgetInstance }>,
      }),
    );

    const schemas = context.contributions(JSON_SCHEMAS);
    const applySchemas = (list: readonly { value: JsonSchemaContribution }[]) =>
      monaco.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: true,
        enableSchemaRequest: false,
        schemas: list.map(({ value }, index) => ({
          uri: `nanoforge://schemas/${index}.json`,
          fileMatch: value.fileMatch.map((glob) => `file:///${glob}`),
          schema: typeof value.schema === 'function' ? value.schema() : value.schema,
        })),
      });
    context.subscriptions.add({ dispose: schemas.subscribe(applySchemas) });

    const themes = services.get(ThemeServiceToken);
    const projects = services.get(ProjectServiceToken);
    const contextKeys = services.get(EditorServices.ContextKeys);
    let stopFollowing = () => {};
    const unsubscribe = projects.current.subscribe((project) => {
      stopFollowing();
      contextKeys.delete(CODE_EDITOR_ACTIVE_FILE);
      current.get()?.service.dispose();
      current.set(undefined);
      if (!project) return;
      const service = new CodeEditorService({
        monaco,
        project,
        documents: services.get(DocumentServiceToken),
        code: services.tryGet(CodeServiceToken),
        diagnostics: services.tryGet(DiagnosticsServiceToken),
        settings: services.get(SettingsServiceToken),
        notifications: services.tryGet(NotificationServiceToken),
        logger: context.logger,
      });
      service.applyTheme(themes.current.get());
      current.set({ service, monaco });
      stopFollowing = service.layout.subscribe(() => {
        const path = service.activePath();
        if (path) contextKeys.set(CODE_EDITOR_ACTIVE_FILE, path);
        else contextKeys.delete(CODE_EDITOR_ACTIVE_FILE);
      });
    });
    context.subscriptions.add({
      dispose: () => {
        unsubscribe();
        stopFollowing();
        contextKeys.delete(CODE_EDITOR_ACTIVE_FILE);
        current.get()?.service.dispose();
        current.set(undefined);
      },
    });
    context.subscriptions.add(
      observe(themes.current, (theme) => current.get()?.service.applyTheme(theme)),
    );

    const withService =
      <A extends unknown[]>(run: (service: CodeEditorService, ...args: A) => unknown) =>
      (...args: A) => {
        const active = current.get()?.service;
        return active ? run(active, ...args) : undefined;
      };

    const commands: [string, (...args: never[]) => unknown][] = [
      [
        'codeEditor.open',
        withService(async (service, path: string, options: OpenOptions = {}) => {
          await context.executeCommand('workbench.openWidget', SCRIPT_SCREEN);
          await service.open(path, options);
        }),
      ],
      [
        'codeEditor.compare',
        withService(async (service, path: string, comparison: Comparison) => {
          await context.executeCommand('workbench.openWidget', SCRIPT_SCREEN);
          await service.compare(path, comparison);
        }),
      ],
      ['codeEditor.save', withService((service) => service.save())],
      ['codeEditor.saveAll', withService((service) => service.saveAll())],
      ['codeEditor.revert', withService((service) => service.revert())],
      ['codeEditor.format', withService((service) => service.format())],
      ['codeEditor.organizeImports', withService((service) => service.organizeImports())],
      ['codeEditor.splitRight', withService((service) => service.splitRight())],
      [
        'codeEditor.closeTab',
        withService((service) => {
          const layout = service.layout.get();
          const active = layout.groups[layout.focused]?.active;
          if (active) service.close(layout.focused, active);
        }),
      ],
    ];
    for (const [id, handler] of commands) {
      context.subscriptions.add(
        context.registerCommand(id, (_services, ...args: unknown[]) =>
          (handler as (...args: unknown[]) => unknown)(...args),
        ),
      );
    }
  },
});
