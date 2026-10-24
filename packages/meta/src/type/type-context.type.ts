import type { SourceFile } from 'ts-morph';

export interface TypeContext {
  /** Module of a declaration file: a package name, or the project path of a project file. */
  modulePath(file: SourceFile): string;
}
