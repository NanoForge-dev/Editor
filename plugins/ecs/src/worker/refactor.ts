import type { ExportDeclaration, ImportDeclaration, SourceFile } from 'ts-morph';

import type { AnalyzeContext, TransformContext } from '@nanoforge-dev/editor-sdk/worker';

const ROOT = '/project/';
const projectPath = (file: SourceFile) => file.getFilePath().replace(ROOT, '');

const moduleDeclarations = (file: SourceFile): (ImportDeclaration | ExportDeclaration)[] => [
  ...file.getImportDeclarations(),
  ...file.getExportDeclarations().filter((declaration) => declaration.getModuleSpecifier()),
];

/** Project files that import the analyzed file (Move to shared library rewrites them). */
export const analyzeImporters = (context: AnalyzeContext): string[] =>
  context.project
    .getSourceFiles()
    .filter((file) =>
      moduleDeclarations(file).some(
        (declaration) => declaration.getModuleSpecifierSourceFile() === context.file,
      ),
    )
    .map(projectPath)
    .filter((path) => !path.startsWith('node_modules/'))
    .sort();

/**
 * The analyzed file's text with its own imports written as if it were at `to`, and the project
 * files it imports (a shared library must not import an app).
 */
export const analyzeRelocatedText = (
  context: AnalyzeContext,
  args: unknown,
): { text: string; imports: string[] } => {
  const { to } = args as { to: string };
  const replacements: { start: number; end: number; text: string }[] = [];
  const imports: string[] = [];
  for (const declaration of moduleDeclarations(context.file)) {
    const target = declaration.getModuleSpecifierSourceFile();
    const specifier = declaration.getModuleSpecifier();
    if (!target || !specifier) continue;
    if (!projectPath(target).startsWith('node_modules/')) imports.push(projectPath(target));
    const value = declaration.getModuleSpecifierValue() ?? '';
    if (!value.startsWith('.')) continue;
    const quote = specifier.getText()[0];
    replacements.push({
      start: specifier.getStart(),
      end: specifier.getEnd(),
      text: `${quote}${context.moduleSpecifier(projectPath(target), to)}${quote}`,
    });
  }
  let text = context.text;
  for (const replacement of replacements.sort((a, b) => b.start - a.start))
    text = text.slice(0, replacement.start) + replacement.text + text.slice(replacement.end);
  return { text, imports: [...new Set(imports)].sort() };
};

/** Points the imports of `from` to `to` (a file moved to a shared library). */
export const transformRewriteImports = (context: TransformContext, op: unknown): void => {
  const { from, to } = op as { from: string; to: string };
  for (const declaration of moduleDeclarations(context.file)) {
    const target = declaration.getModuleSpecifierSourceFile();
    const specifier = declaration.getModuleSpecifier();
    if (!target || !specifier || projectPath(target) !== from) continue;
    const quote = specifier.getText()[0];
    context.edit.replace(specifier, `${quote}${context.moduleSpecifier(to)}${quote}`);
  }
};
