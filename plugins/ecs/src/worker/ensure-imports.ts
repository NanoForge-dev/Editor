import type { TransformContext } from '@nanoforge-dev/editor-sdk/worker';

import type { ImportNeed } from '../model/ecs-model.type';
import { CODE_EXTENSION } from './transform-helpers';

/** Adds the imports a change needs, merging into existing imports of the same module. */
export const ensureImports = (context: TransformContext, needs: readonly ImportNeed[]): void => {
  const { file, edit } = context;
  const imported = new Set(
    file
      .getImportDeclarations()
      .flatMap((declaration) => [
        ...declaration
          .getNamedImports()
          .map((named) => (named.getAliasNode() ?? named.getNameNode()).getText()),
        ...(declaration.getDefaultImport() ? [declaration.getDefaultImport()!.getText()] : []),
      ]),
  );
  const declared = new Set(
    [...file.getClasses(), ...file.getFunctions(), ...file.getEnums()].flatMap((node) =>
      node.getName() ? [node.getName()!] : [],
    ),
  );
  const byModule = new Map<string, string[]>();
  for (const need of needs) {
    if (imported.has(need.name) || declared.has(need.name)) continue;
    const specifier = CODE_EXTENSION.test(need.from)
      ? context.moduleSpecifier(need.from)
      : need.from;
    const names = byModule.get(specifier) ?? [];
    if (!names.includes(need.name)) names.push(need.name);
    byModule.set(specifier, names);
    imported.add(need.name);
  }
  const quote = context.literals.quoteStyle(file);
  for (const [specifier, names] of byModule) {
    const existing = file
      .getImportDeclarations()
      .find(
        (declaration) =>
          declaration.getModuleSpecifierValue() === specifier && !declaration.isTypeOnly(),
      );
    const last = existing?.getNamedImports().at(-1);
    if (last) {
      edit.insertAfter(last, `, ${names.join(', ')}`);
      continue;
    }
    const line = `import { ${names.join(', ')} } from ${quote}${specifier}${quote};`;
    const lastImport = file.getImportDeclarations().at(-1);
    if (lastImport) edit.insertAfter(lastImport, `\n${line}`);
    else edit.insertAt(0, `${line}\n\n`);
  }
};
