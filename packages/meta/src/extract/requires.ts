import type { SourceFile } from 'ts-morph';

import { packageOfPath } from '../type/package-of-path';
import { packageOfSpecifier } from './param-fields';

/** npm packages a file imports (type-only too), sorted. */
export const requiresOf = (file: SourceFile): string[] =>
  [
    ...new Set(
      [...file.getImportDeclarations(), ...file.getExportDeclarations()].flatMap((declaration) => {
        const specifier = declaration.getModuleSpecifierValue();
        const name = specifier ? packageOfSpecifier(specifier) : undefined;
        return name ? [name] : [];
      }),
    ),
  ].sort();

/** Default module path: a package inside `node_modules`, else the file path without `/project/`. */
export const defaultModulePath = (file: SourceFile): string => {
  const path = file.getFilePath();
  return packageOfPath(path) ?? path.replace(/^\/project\//, '');
};
