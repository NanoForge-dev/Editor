import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

/**
 * JavaScript of `@nanoforge-dev/editor-sdk/ui`. Its components are Svelte, which only the editor
 * compiles: plugins built with `@nanoforge-dev/editor-vite-plugin` take the editor's own module.
 * Every export of the published one throws when used, saying so (tests mock the module).
 */
const root = join(import.meta.dirname, '..');
const entry = join(root, 'dist/types/sdk/src/ui.d.ts');
const program = ts.createProgram([entry], { noEmit: true, skipLibCheck: true });
const checker = program.getTypeChecker();
const module = checker.getSymbolAtLocation(program.getSourceFile(entry)!)!;
const values = checker
  .getExportsOfModule(module)
  .filter((symbol) => {
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    return target.flags & ts.SymbolFlags.Value;
  })
  .map((symbol) => symbol.name)
  .sort();
if (!values.length) throw new Error(`No exports found in ${entry}`);

const lines = [
  'const message = (name) =>',
  '  `${name} of @nanoforge-dev/editor-sdk/ui is provided by the NanoForge editor at runtime: build the plugin with @nanoforge-dev/editor-vite-plugin, and mock the module in unit tests.`;',
  'const unavailable = (name) =>',
  '  new Proxy(function () {}, {',
  '    get: (_target, key) => (key === Symbol.toPrimitive ? undefined : unavailable(name)),',
  '    apply: () => {',
  '      throw new Error(message(name));',
  '    },',
  '    construct: () => {',
  '      throw new Error(message(name));',
  '    },',
  '  });',
  ...values.map((name) => `export const ${name} = unavailable('${name}');`),
  '',
];
writeFileSync(join(root, 'dist/ui.js'), lines.join('\n'));
console.log(`SDK ui stub written: ${values.length} exports`);
