import { readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { emitDts } from 'svelte2tsx';
import ts from 'typescript';

/**
 * Types of the published SDK. The editor packages it reaches are private: their declarations are
 * emitted next to the SDK's (Svelte components through svelte2tsx), and their specifiers are
 * rewritten to relative paths.
 */
const root = join(import.meta.dirname, '..');
const packages = dirname(root);
const out = join(root, 'dist', 'types');
const generated = join(root, 'tsconfig.types.generated.json');

/** `@nanoforge-dev/<name>[/sub]` → its source file, from each package's own `exports`. */
const sources = new Map<string, string>();
for (const folder of readdirSync(packages)) {
  const manifest = join(packages, folder, 'package.json');
  if (!statSync(join(packages, folder)).isDirectory()) continue;
  const { name, exports } = JSON.parse(readFileSync(manifest, 'utf8')) as {
    name: string;
    exports: Record<string, string | { default: string }>;
  };
  for (const [subpath, target] of Object.entries(exports)) {
    const file = typeof target === 'string' ? target : target.default;
    if (!file.endsWith('.ts')) continue;
    sources.set(join(name, subpath), join(packages, folder, file));
  }
}

rmSync(out, { recursive: true, force: true });
writeFileSync(
  generated,
  JSON.stringify({
    extends: './tsconfig.types.json',
    compilerOptions: {
      paths: Object.fromEntries(
        [...sources].map(([specifier, file]) => [specifier, [relative(root, file)]]),
      ),
    },
  }),
);
try {
  await emitDts({
    libRoot: packages,
    declarationDir: out,
    tsconfig: generated,
    svelteShimsPath: createRequire(import.meta.url).resolve('svelte2tsx/svelte-shims-v4.d.ts'),
  });
} finally {
  rmSync(generated, { force: true });
}

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.d.ts') ? [path] : [];
  });

/** A module specifier where a declaration file imports or augments one. */
const SPECIFIER = /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\bdeclare module\s+)(['"])([^'"]+)\2/g;
const unknown = new Map<string, string>();
const imports = new Map<string, string[]>();
for (const file of walk(out)) {
  const text = readFileSync(file, 'utf8');
  const local: string[] = [];
  const rewritten = text.replace(
    SPECIFIER,
    (match, keyword: string, quote: string, specifier: string) => {
      if (specifier.startsWith('.')) {
        local.push(join(dirname(file), specifier));
        return match;
      }
      if (!specifier.startsWith('@nanoforge-dev/')) return match;
      const source = sources.get(specifier);
      if (!source) {
        unknown.set(file, specifier);
        return match;
      }
      const target = join(out, relative(packages, source)).replace(/\.ts$/, '.js');
      local.push(target);
      const path = relative(dirname(file), target);
      return `${keyword}${quote}${path.startsWith('.') ? path : `./${path}`}${quote}`;
    },
  );
  imports.set(file, local);
  if (rewritten !== text) writeFileSync(file, rewritten);
}

/** Only what the SDK's entries reach is published: emitDts writes every file of `packages`. */
const declaration = (path: string) =>
  [path.replace(/\.js$/, '.d.ts'), `${path}.d.ts`, join(path, 'index.d.ts')].find((candidate) =>
    imports.has(candidate),
  );
const reached = new Set<string>();
const queue = ['index', 'ui', 'worker'].map((entry) => join(out, 'sdk', 'src', `${entry}.d.ts`));
for (let file = queue.pop(); file; file = queue.pop()) {
  if (reached.has(file)) continue;
  reached.add(file);
  for (const target of imports.get(file) ?? []) {
    const found = declaration(target);
    if (found) queue.push(found);
  }
}
for (const file of imports.keys()) if (!reached.has(file)) rmSync(file);
const prune = (dir: string): void => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) prune(path);
  }
  if (!readdirSync(dir).length) rmSync(dir, { recursive: true });
};
prune(out);

/** The published declarations must check on their own (svelte2tsx can emit clashing names). */
const entries = ['index', 'ui', 'worker'].map((entry) => join(out, 'sdk', 'src', `${entry}.d.ts`));
const program = ts.createProgram(entries, {
  noEmit: true,
  strict: true,
  skipLibCheck: false,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ESNext,
  lib: ['lib.esnext.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  types: [],
});
const errors = ts
  .getPreEmitDiagnostics(program)
  .filter((diagnostic) => diagnostic.file?.fileName.startsWith(out));
if (errors.length)
  throw new Error(
    ts.formatDiagnostics(errors, {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => root,
      getNewLine: () => '\n',
    }),
  );

const leaks = [...unknown].filter(([file]) => reached.has(file));
if (leaks.length)
  throw new Error(
    `SDK types import packages that are not published: ${leaks.map(([file, specifier]) => `${specifier} (${relative(out, file)})`).join(', ')}`,
  );
console.log(`SDK types written to ${relative(root, out)}: ${reached.size} files`);
