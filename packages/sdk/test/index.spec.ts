import { describe, expect, it } from 'vitest';

import { EventBus, createCoreContainer } from '@nanoforge-dev/editor-kernel';

import { EditorServices, definePlugin } from '../src';

declare module '../src' {
  interface EditorEvents {
    'sdk.test': { ok: boolean };
  }
}

describe('sdk', () => {
  it('types the editor event bus with augmented EditorEvents', () => {
    const services = createCoreContainer();
    const bus = services.get(EditorServices.EventBus);
    expect(bus).toBeInstanceOf(EventBus);
    let received = false;
    bus.on('sdk.test', ({ ok }) => (received = ok));
    bus.emit('sdk.test', { ok: true });
    expect(received).toBe(true);
    services.dispose();
  });

  it('definePlugin is an identity helper', () => {
    const plugin = { activate: () => undefined };
    expect(definePlugin(plugin)).toBe(plugin);
  });
});

describe('public API', () => {
  it('only changes on purpose (update the snapshot when adding to the SDK)', async () => {
    const sdk = await import('../src');
    expect(Object.keys(sdk).sort()).toMatchInlineSnapshot(`
      [
        "AccountSyncToken",
        "CODEGEN_TARGETS",
        "COMMAND_METADATA",
        "CatalogServiceToken",
        "CodeServiceToken",
        "CoreSettings",
        "DOCUMENT_EDITORS",
        "DiagnosticsServiceToken",
        "DisposableObject",
        "DisposableStore",
        "DocumentServiceToken",
        "EditorServices",
        "Emitter",
        "Events",
        "FileHistoryTracker",
        "GitContract",
        "HISTORY_CONTEXT_KEY",
        "HistoryServiceToken",
        "JSON_SCHEMAS",
        "LogLevel",
        "MutableDisposable",
        "ObservableValue",
        "PluginHostToken",
        "ProjectServiceToken",
        "RUNTIME_PROTOCOL_VERSION",
        "RegistryContract",
        "RpcClientToken",
        "RpcError",
        "RuntimeServiceToken",
        "RuntimeSettings",
        "SessionContract",
        "SettingsRegistryToken",
        "SettingsServiceToken",
        "TEXT_INPUT_FOCUS_KEY",
        "WorkspaceError",
        "appRefName",
        "applyTextEdits",
        "basename",
        "changes",
        "combineDisposables",
        "compositeCommand",
        "constant",
        "createApp",
        "createLibrary",
        "createToken",
        "defineContract",
        "defineExtensionPoint",
        "definePlugin",
        "defineSetting",
        "derived",
        "dirname",
        "disposeAll",
        "documentHistoryId",
        "editorsFor",
        "formatLogValue",
        "formatMessage",
        "isDisposable",
        "isEligible",
        "isExpandableLogValue",
        "isPlaying",
        "itemFitsApp",
        "joinPath",
        "jsonSchemaOf",
        "librariesOf",
        "libraryImporters",
        "matchesGlob",
        "missingEngineLibs",
        "observe",
        "ownerObjects",
        "parseWhen",
        "removeApp",
        "removeLibrary",
        "renameApp",
        "renameLibrary",
        "runnableApps",
        "runtimeOutputPath",
        "selectTarget",
        "serializeLogValue",
        "setLibraryUse",
        "switchObservable",
        "toDisposable",
        "validateFolder",
        "validatePackageName",
        "workspaceIo",
      ]
    `);
  });
});
