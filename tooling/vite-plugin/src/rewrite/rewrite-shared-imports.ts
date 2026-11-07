import { init, parse } from 'es-module-lexer';

import {
  DROPPED_MODULES,
  FORBIDDEN_MODULES,
  SHARED_GLOBAL,
  isHostModule,
} from '../shared-module/shared-modules';

const lookup = (specifier: string) =>
  `globalThis[${JSON.stringify(SHARED_GLOBAL)}].require(${JSON.stringify(specifier)})`;

/** `a as b, c` → `a: b, c` (object destructuring syntax). */
const toDestructuring = (namedClause: string) =>
  namedClause
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [imported, local] = part.split(/\s+as\s+/);
      const key = /^["']/.test(imported!) ? imported : imported!.trim();
      return local ? `${key}: ${local.trim()}` : key;
    })
    .join(', ');

/**
 * Rewrites the static import clause of `import <clause> from '<shared>'` into declarations.
 * Supports default, namespace, named and combined clauses.
 */
const rewriteClause = (clause: string, specifier: string): string => {
  const source = lookup(specifier);
  const declarations: string[] = [];
  let rest = clause.trim();

  const defaultMatch = /^([\w$]+)\s*(?:,|$)/.exec(rest);
  if (defaultMatch) {
    declarations.push(`const ${defaultMatch[1]} = ${source}.default;`);
    rest = rest.slice(defaultMatch[0].length).trim();
  }
  const namespaceMatch = /^\*\s*as\s+([\w$]+)$/.exec(rest);
  if (namespaceMatch) {
    declarations.push(`const ${namespaceMatch[1]} = ${source};`);
    rest = '';
  }
  const namedMatch = /^\{([\s\S]*)\}$/.exec(rest);
  if (namedMatch) {
    const names = toDestructuring(namedMatch[1]!);
    if (names) declarations.push(`const { ${names} } = ${source};`);
    rest = '';
  }
  if (rest) throw new Error(`Unsupported import of shared module "${specifier}": ${clause}`);
  return declarations.join('\n');
};

/**
 * Replaces every import of a shared module in an ES module chunk by a lookup in the host's
 * shared module registry. Returns `null` when the chunk does not import any shared module.
 *
 * Re-exports (`export … from 'shared'`) are rejected: plugins must import then export.
 */
export const rewriteSharedImports = async (code: string): Promise<string | null> => {
  await init;
  const [imports] = parse(code);
  const edits: { start: number; end: number; text: string }[] = [];

  for (const entry of imports) {
    const specifier = entry.n;
    if (!specifier || !isHostModule(specifier)) continue;

    const forbidden = FORBIDDEN_MODULES.get(specifier);
    if (forbidden) throw new Error(`Cannot import "${specifier}": ${forbidden}`);
    if (DROPPED_MODULES.has(specifier)) {
      edits.push({ start: entry.ss, end: entry.se, text: '' });
      continue;
    }

    if (entry.d > -1) {
      edits.push({
        start: entry.ss,
        end: entry.se,
        text: `Promise.resolve(${lookup(specifier)})`,
      });
      continue;
    }
    const statement = code.slice(entry.ss, entry.se);
    if (/^export\b/.test(statement)) {
      throw new Error(`Re-exporting shared module "${specifier}" is not supported: ${statement}`);
    }
    const clauseMatch = /^import\s*([\s\S]*?)\s*from\s*["']/.exec(statement);
    const text = clauseMatch ? rewriteClause(clauseMatch[1]!, specifier) : '';
    edits.push({ start: entry.ss, end: entry.se, text });
  }
  if (!edits.length) return null;

  let result = code;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }
  return result;
};
