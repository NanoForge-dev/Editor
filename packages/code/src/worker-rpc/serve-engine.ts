import { CodeEngine } from '../engine/code-engine';
import type { CodeDiagnostic, CodeSymbol, SourceText, TextEdit } from '../engine/engine.type';
import type { MetaRequest, MetaResponse } from '../engine/extract-meta';
import { type WorkerPluginModule, createWorkerSdk } from '../engine/worker-sdk';
import { type MessageEndpoint, expose, wrap } from './worker-rpc';

/** API of the engine as seen from the main thread. */
export interface EngineApi {
  setFiles(files: readonly SourceText[]): void;
  deleteFiles(paths: readonly string[]): void;
  analyze(path: string, analyzerId: string, args?: unknown): unknown;
  transform(path: string, transformerId: string, op: unknown): TextEdit[];
  diagnostics(paths: readonly string[]): Promise<CodeDiagnostic[]>;
  organizeImports(path: string): Promise<TextEdit[]>;
  symbols(path: string): CodeSymbol[];
  setTsconfig(text: string | undefined): void;
  extractMeta(request: MetaRequest): Promise<MetaResponse>;
  itemOwners(): { name: string; version: string; schema: number }[];
  /** Imports a plugin's `entry.worker` and calls its `activate(sdk)`. */
  loadPlugin(owner: string, url: string): Promise<void>;
  unloadPlugin(owner: string): void;
}

/** Services the main thread offers to the worker. */
export interface EngineHostApi {
  resolveTypes(module: string, from: string): Promise<readonly SourceText[]>;
}

export interface ServeOptions {
  /** How plugin modules are imported (tests inject a loader). */
  readonly importModule?: (url: string) => Promise<unknown>;
}

/** Runs a code engine behind a message endpoint (the worker's `self`, or a MessagePort). */
export const serveEngine = (
  endpoint: MessageEndpoint,
  options: ServeOptions = {},
): (() => void) => {
  const host = wrap<EngineHostApi>(endpoint);
  const engine = new CodeEngine({
    resolveTypes: (module, from) => host.resolveTypes(module, from),
  });
  const importModule = options.importModule ?? ((url: string) => import(/* @vite-ignore */ url));
  const api: EngineApi = {
    setFiles: (files) => engine.setFiles(files),
    deleteFiles: (paths) => engine.deleteFiles(paths),
    analyze: (path, analyzerId, args) => engine.analyze(path, analyzerId, args),
    transform: (path, transformerId, op) => engine.transform(path, transformerId, op),
    diagnostics: (paths) => engine.diagnostics(paths),
    symbols: (path) => engine.symbols(path),
    organizeImports: (path) => engine.organizeImports(path),
    setTsconfig: (text) => engine.setTsconfig(text),
    extractMeta: (request) => engine.extractMeta(request),
    itemOwners: () => engine.itemOwners,
    loadPlugin: async (owner, url) => {
      engine.unregisterOwner(owner);
      const imported = (await importModule(url)) as WorkerPluginModule & {
        default?: WorkerPluginModule;
      };
      const plugin = imported.activate ? imported : (imported.default ?? {});
      await plugin.activate?.(createWorkerSdk(engine, owner));
    },
    unloadPlugin: (owner) => engine.unregisterOwner(owner),
  };
  const stop = expose(api, endpoint);
  return () => {
    stop();
    host.dispose();
  };
};
