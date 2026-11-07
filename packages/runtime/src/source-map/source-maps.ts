import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';

import { type AppModel, decodeRuntimeApp, runtimeOutputPath } from '@nanoforge-dev/editor-protocol';

import type { SourceLocation, SourceMapsOptions } from './source-maps.type';

const defaultFetch = async (url: string): Promise<string | undefined> => {
  const response = await fetch(url);
  return response.ok ? response.text() : undefined;
};

/** Joins POSIX paths and resolves `.` and `..`; undefined when it leaves the root. */
const resolvePath = (...parts: string[]): string | undefined => {
  const segments: string[] = [];
  for (const segment of parts.join('/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment !== '..') segments.push(segment);
    else if (!segments.pop()) return undefined;
  }
  return segments.join('/');
};

/**
 * Maps positions in built game bundles back to project files, through the source maps written
 * next to the bundles (`nf build --editor`). A bundle is named by its URL (clients, imported
 * from the editor server) or by its path on disk (servers).
 */
export class SourceMaps {
  private readonly _maps = new Map<string, Promise<TraceMap | undefined>>();

  constructor(private readonly _options: SourceMapsOptions) {}

  /** Forgets the maps of an app (it was rebuilt). */
  invalidate(app: string): void {
    for (const key of this._maps.keys()) if (key.startsWith(`${app}\n`)) this._maps.delete(key);
  }

  async locate(file: string, line: number, column = 1): Promise<SourceLocation | undefined> {
    const bundle = this._bundle(file);
    if (!bundle) return undefined;
    const map = await this._map(bundle.app, bundle.file);
    if (!map) return undefined;
    const position = originalPositionFor(map, { line, column: Math.max(column - 1, 0) });
    if (!position.source || position.line === null) return undefined;
    const folder = bundle.file.split('/').slice(0, -1);
    const path = resolvePath(bundle.app.outDir ?? '', ...folder, position.source);
    if (path === undefined || /(^|\/)node_modules\//.test(path)) return undefined;
    return { path, line: position.line, column: (position.column ?? 0) + 1 };
  }

  /** The app and output file a bundle URL or path belongs to. */
  private _bundle(file: string): { app: AppModel; file: string } | undefined {
    const apps = this._options.apps().filter((app) => app.outDir !== undefined);
    const prefix = `/runtime/${this._options.projectId}/`;
    let pathname = file;
    if (/^https?:\/\//.test(file)) {
      try {
        pathname = new URL(file).pathname;
      } catch {
        return undefined;
      }
      if (!pathname.startsWith(prefix)) return undefined;
      const [segment, ...rest] = pathname.slice(prefix.length).split('/');
      const id = decodeRuntimeApp(segment ?? '');
      const app = apps.find((candidate) => candidate.id === id);
      return app && rest.length ? { app, file: rest.map(decodeURIComponent).join('/') } : undefined;
    }
    pathname = pathname.replace(/^file:\/\//, '').replace(/\\/g, '/');
    const owner = apps
      .map((app) => ({ app, at: pathname.lastIndexOf(`/${app.outDir}/`) }))
      .filter(({ at }) => at >= 0)
      .sort((a, b) => b.app.outDir!.length - a.app.outDir!.length)[0];
    if (!owner) return undefined;
    return {
      app: owner.app,
      file: pathname.slice(owner.at + owner.app.outDir!.length + 2),
    };
  }

  private _map(app: AppModel, file: string): Promise<TraceMap | undefined> {
    const key = `${app.id}\n${file}`;
    let map = this._maps.get(key);
    if (!map) {
      const url = `${this._options.origin}${runtimeOutputPath(this._options.projectId, app.id)}${file
        .split('/')
        .map(encodeURIComponent)
        .join('/')}.map`;
      map = (this._options.fetchText ?? defaultFetch)(url)
        .then((text) => (text ? new TraceMap(text) : undefined))
        .catch(() => undefined);
      this._maps.set(key, map);
    }
    return map;
  }
}
