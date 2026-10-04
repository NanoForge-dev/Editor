/**
 * Public API of the NanoForge editor for plugins.
 *
 * At runtime this module is provided by the editor (plugins built with
 * `@nanoforge-dev/editor-vite-plugin` never bundle it), so every plugin shares the same
 * services, registries and tokens.
 */
import {
  CoreServices,
  type EventBus,
  type ExtensionPoint,
  type PluginContext,
  type PluginModule,
  type ServiceToken,
} from '@nanoforge-dev/editor-kernel';

export {
  type Disposable,
  DisposableObject,
  DisposableStore,
  MutableDisposable,
  combineDisposables,
  disposeAll,
  isDisposable,
  toDisposable,
  Emitter,
  type EmitterOptions,
  type Event,
  Events,
  type Listener,
  type Equality,
  type Observable,
  ObservableValue,
  changes,
  constant,
  derived,
  observe,
  type ProvideOptions,
  type ServiceAccessor,
  type ServiceDecorator,
  type ServiceFactory,
  type ServiceToken,
  createToken,
  type Contribution,
  type ExtensionPoint,
  type Validator,
  defineExtensionPoint,
  type ContextKeyService,
  type WhenExpression,
  parseWhen,
  COMMAND_METADATA,
  type CommandHandler,
  type CommandMetadata,
  type CommandMetadataContribution,
  type MessageBundle,
  type MessageParams,
  formatMessage,
  type LogEntry,
  LogLevel,
  type LogLocation,
  type LogValue,
  type LogValueLimits,
  type Logger,
  type LoggerService,
  formatLogValue,
  isExpandableLogValue,
  serializeLogValue,
  type AppInfo,
  type AppType,
  type MissingEngineLib,
  type PluginContext,
  type PluginManifest,
  type PluginModule,
  isEligible,
  missingEngineLibs,
  type PluginHost,
  PluginHostToken,
  type PluginInfo,
  switchObservable,
} from '@nanoforge-dev/editor-kernel';

export {
  type ClientProject,
  type ProjectFs,
  type ProjectService,
  ProjectServiceToken,
  type WriteOptions,
} from '@nanoforge-dev/editor-project';
export type {
  AppModel,
  FileChange,
  FileContent,
  FileEntry,
  ProjectModel,
} from '@nanoforge-dev/editor-protocol';
export { basename, dirname, joinPath, runtimeOutputPath } from '@nanoforge-dev/editor-protocol';

export {
  type NewApp,
  type NewLibrary,
  type Undo,
  WorkspaceError,
  type WorkspaceIo,
  createApp,
  createLibrary,
  librariesOf,
  libraryImporters,
  removeApp,
  removeLibrary,
  renameApp,
  renameLibrary,
  runnableApps,
  setLibraryUse,
  validateFolder,
  validatePackageName,
  workspaceIo,
} from '@nanoforge-dev/editor-project';

export {
  type GitBranch,
  type GitChange,
  type GitCommit,
  GitContract,
  type GitFile,
  type GitStash,
  type GitStatus,
} from '@nanoforge-dev/editor-protocol';

export { SessionContract, type SessionInfo } from '@nanoforge-dev/editor-protocol';

export {
  type InstalledPackage,
  type PluginScope,
  RegistryContract,
  type RegistryItem,
  type RegistrySearchResult,
  type RegistrySummary,
  type RegistryVersion,
} from '@nanoforge-dev/editor-protocol';

export {
  type CatalogItem,
  type CatalogService,
  CatalogServiceToken,
  type CatalogState,
  appRefName,
  itemFitsApp,
  CODEGEN_TARGETS,
  type CodeDiagnostic,
  type CodeSymbol,
  type CodeService,
  CodeServiceToken,
  type CodegenTarget,
  DOCUMENT_EDITORS,
  type DiagnosticsService,
  type DocumentBackend,
  DiagnosticsServiceToken,
  type DocumentChange,
  type DocumentEditor,
  type DocumentService,
  DocumentServiceToken,
  type NodeRef,
  type OpenDocument,
  JSON_SCHEMAS,
  type JsonSchemaContribution,
  documentHistoryId,
  editorsFor,
  matchesGlob,
  selectTarget,
} from '@nanoforge-dev/editor-code';

export type {
  Element,
  ElementLayout,
  ElementType,
  EnumMember,
  ItemMeta,
  ItemRef,
  MetaDiagnostic,
  MetaSource,
  ParamGroup,
  Side,
} from '@nanoforge-dev/editor-meta';
export { ownerObjects } from '@nanoforge-dev/editor-meta/pure';

export {
  type GameEvent,
  type PlayMode,
  type PlaySession,
  type PlayState,
  type RuntimeLog,
  type SourceLocation,
  type RuntimeService,
  RuntimeServiceToken,
  RuntimeSettings,
  isPlaying,
} from '@nanoforge-dev/editor-runtime';
export {
  type BuildDiagnostic,
  type BuildStatus,
  type EngineFeatures,
  type EngineFrameStats,
  type EngineNetworkStats,
  type EngineNetworkTrace,
  type EngineScenes,
  type EngineSystemStats,
  type EngineViewport,
  type EngineWorld,
  type EngineWorldValue,
  RUNTIME_PROTOCOL_VERSION,
  type RuntimeCommand,
} from '@nanoforge-dev/editor-protocol';

export {
  type CommandOrigin,
  type CommandPreview,
  FileHistoryTracker,
  HISTORY_CONTEXT_KEY,
  type HistoryCommand,
  type HistoryContext,
  type HistoryContextInfo,
  type HistoryEntry,
  type HistoryService,
  HistoryServiceToken,
  type HistoryStack,
  TEXT_INPUT_FOCUS_KEY,
  type TextEdit,
  type Transaction,
  applyTextEdits,
  compositeCommand,
} from '@nanoforge-dev/editor-history';

export {
  CoreSettings,
  type MergeStrategy,
  type SettingDefinition,
  type SettingInspection,
  type SettingScope,
  type SettingsService,
  SettingsServiceToken,
  type SettingsRegistry,
  SettingsRegistryToken,
  AccountSyncToken,
  type SyncStatus,
  type MergeConflict,
  type ImportPreview,
  jsonSchemaOf,
  type WritableScope,
  defineSetting,
} from '@nanoforge-dev/editor-settings';

export {
  type Contract,
  type RpcApi,
  type RpcClient,
  RpcClientToken,
  RpcError,
  type RpcErrorCode,
  defineContract,
} from '@nanoforge-dev/editor-rpc';

/**
 * Editor-wide events. Extend it by module augmentation:
 *
 * ```ts
 * declare module '@nanoforge-dev/editor-sdk' {
 *   interface EditorEvents {
 *     'ecs.entitySelected': { app: string; entity: string };
 *   }
 * }
 * ```
 */

export interface EditorEvents {}

/** Services every editor provides, resolvable with `context.services.get(...)`. */
export const EditorServices = {
  ...CoreServices,
  EventBus: CoreServices.EventBus as unknown as ServiceToken<EventBus<EditorEvents>>,
} as const;

/** Declares a plugin entry. Export the result as `default` or spread it into named exports. */
export const definePlugin = (plugin: PluginModule): PluginModule => plugin;

/** Helper type: the value type of an extension point. */
export type ContributionOf<P> = P extends ExtensionPoint<infer T> ? T : never;

/** Helper type: the activation context, for plugin authors' own helpers. */
export type EditorPluginContext = PluginContext;
