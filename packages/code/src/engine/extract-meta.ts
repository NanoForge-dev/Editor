import { Node, type Project } from 'ts-morph';

import {
  type ItemMeta,
  type ItemOwner,
  type MetaDiagnostic,
  type MetaSource,
  defaultModulePath,
  extractItems,
  sourceHash,
} from '@nanoforge-dev/editor-meta';

/** A file of a source to extract items from. */
export interface MetaSourceFile {
  /** Project path. */
  readonly path: string;
  /** The item folder it is in (`dir.components`, `dir.systems`), if any. */
  readonly folder?: 'components' | 'systems';
  /** Listed in a manifest's `items`: each export is an item. */
  readonly listed?: boolean;
}

/** The folder of a source and the base of its item references (`app:client`, `@me/shared`). */
export interface MetaRoot {
  readonly path: string;
  readonly ref: string;
}

export interface MetaRequest {
  readonly source: MetaSource;
  readonly files: readonly MetaSourceFile[];
  /** Every source of the project, so items of other sources get their reference. */
  readonly roots: readonly MetaRoot[];
  /**
   * Current texts of the files (open documents included), applied before extracting so the
   * items and the hash come from the same text.
   */
  readonly texts?: readonly { readonly path: string; readonly text: string }[];
}

export interface MetaResponse {
  readonly items: ItemMeta[];
  readonly diagnostics: MetaDiagnostic[];
  /** Owners that ran, with their version and schema (the meta file's `owners`). */
  readonly owners: Record<string, { version: string; schema: number }>;
  /** Hash of the files' current text (the meta file's `sourceHash`). */
  readonly sourceHash: string;
  /** Files that aren't loaded in the engine. */
  readonly missing: string[];
}

const ROOT = '/project/';
const toProjectPath = (path: string) => (path.startsWith(ROOT) ? path.slice(ROOT.length) : path);

/** Items of a source, extracted with the registered owners. */
export const extractMeta = async (
  project: Project,
  owners: readonly ItemOwner[],
  request: MetaRequest,
): Promise<MetaResponse> => {
  const roots = [...request.roots].sort((a, b) => b.path.length - a.path.length);
  const refOf = (node: Node) => {
    let symbol = node.getSymbol();
    if (symbol?.isAlias()) symbol = symbol.getAliasedSymbol();
    const declaration = symbol?.getDeclarations()[0];
    if (!symbol || !declaration) return undefined;
    const exportable = Node.isVariableDeclaration(declaration)
      ? declaration.getVariableStatement()
      : declaration;
    if (!exportable || !Node.isExportable(exportable) || !exportable.isExported()) return undefined;
    const path = toProjectPath(declaration.getSourceFile().getFilePath());
    const root = roots.find(
      (candidate) =>
        path === candidate.path || path.startsWith(`${candidate.path}/`) || candidate.path === '',
    );
    return root ? `${root.ref}#${symbol.getName()}` : undefined;
  };

  const items: ItemMeta[] = [];
  const diagnostics: MetaDiagnostic[] = [];
  const texts: { path: string; text: string }[] = [];
  const missing: string[] = [];
  for (const entry of request.files) {
    const file = project.getSourceFile(ROOT + entry.path);
    if (!file) {
      missing.push(entry.path);
      continue;
    }
    texts.push({ path: entry.path, text: file.getFullText() });
    const result = extractItems(file, {
      source: request.source,
      path: entry.path,
      owners,
      ...(entry.folder && { folder: entry.folder }),
      ...(entry.listed && { listed: true }),
      modulePath: (declarationFile) => defaultModulePath(declarationFile),
      refOf,
    });
    items.push(...result.items);
    diagnostics.push(...result.diagnostics);
  }
  return {
    items,
    diagnostics,
    owners: Object.fromEntries(
      owners.map((owner) => [owner.name, { version: owner.version, schema: owner.schema }]),
    ),
    sourceHash: await sourceHash(texts),
    missing,
  };
};
