import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');
const out = join(root, 'dist', 'types');
rmSync(out, { recursive: true, force: true });
execFileSync(join(root, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.types.json'], {
  cwd: root,
  stdio: 'inherit',
});

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.d.ts') ? [path] : [];
  });

const SPECIFIER =
  /(['"])@nanoforge-dev\/editor-(code|history|kernel|project|protocol|rpc|settings)(\/engine)?\1/g;
for (const file of walk(out)) {
  const text = readFileSync(file, 'utf8');
  const rewritten = text.replace(SPECIFIER, (_match, quote: string, name: string, sub?: string) => {
    const target = relative(dirname(file), join(out, name, 'src', sub ? 'engine' : '', 'index.js'));
    return `${quote}${target.startsWith('.') ? target : `./${target}`}${quote}`;
  });
  if (rewritten !== text) writeFileSync(file, rewritten);
}
console.log(`SDK types written to ${relative(root, out)}`);
