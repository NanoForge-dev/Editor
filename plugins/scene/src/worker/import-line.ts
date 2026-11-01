import type { ImportDeclaration, Node } from 'ts-morph';

/** One binding an import brings, with its node. */
export interface Binding {
  readonly kind: 'named' | 'default' | 'namespace';
  readonly imported?: string;
  readonly local: string;
  readonly typeOnly: boolean;
  readonly node: Node;
}

/** The bindings an import declaration brings. */
export const bindingsOf = (declaration: ImportDeclaration): Binding[] => {
  const typeOnly = declaration.isTypeOnly();
  const bindings: Binding[] = [];
  const def = declaration.getDefaultImport();
  if (def) bindings.push({ kind: 'default', local: def.getText(), typeOnly, node: def });
  const namespace = declaration.getNamespaceImport();
  if (namespace)
    bindings.push({ kind: 'namespace', local: namespace.getText(), typeOnly, node: namespace });
  for (const specifier of declaration.getNamedImports()) {
    const local = specifier.getAliasNode() ?? specifier.getNameNode();
    bindings.push({
      kind: 'named',
      imported: specifier.getName(),
      local: local.getText(),
      typeOnly: typeOnly || specifier.isTypeOnly(),
      node: local,
    });
  }
  return bindings;
};

/** An import line of `module` for `bindings`, in the file's quote style. */
export const importLine = (module: string, bindings: readonly Binding[], quote: string): string => {
  const unique = [...new Map(bindings.map((binding) => [binding.local, binding])).values()];
  const allTypes = unique.every((binding) => binding.typeOnly);
  const parts: string[] = [];
  const def = unique.find((binding) => binding.kind === 'default');
  const namespace = unique.find((binding) => binding.kind === 'namespace');
  const named = unique
    .filter((binding) => binding.kind === 'named')
    .sort((a, b) => a.local.localeCompare(b.local))
    .map(
      (binding) =>
        `${binding.typeOnly && !allTypes ? 'type ' : ''}${binding.imported === binding.local ? binding.local : `${binding.imported} as ${binding.local}`}`,
    );
  if (def) parts.push(def.local);
  if (namespace) parts.push(`* as ${namespace.local}`);
  if (named.length) parts.push(`{ ${named.join(', ')} }`);
  return `import ${allTypes ? 'type ' : ''}${parts.join(', ')} from ${quote}${module}${quote};`;
};
