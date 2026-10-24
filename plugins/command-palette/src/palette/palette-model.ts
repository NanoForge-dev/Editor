import type { CodeSymbol } from '@nanoforge-dev/editor-sdk';
import { type EditorAction, actionLabel } from '@nanoforge-dev/editor-sdk/ui';

import { type FuzzyMatch, fuzzyMatch } from './fuzzy';

export type PaletteMode = 'commands' | 'files' | 'line' | 'symbols';

/** The first character of the box picks what is searched. */
export const PREFIXES: Record<Exclude<PaletteMode, 'files'>, string> = {
  commands: '>',
  line: ':',
  symbols: '@',
};

export interface PaletteQuery {
  readonly mode: PaletteMode;
  readonly text: string;
}

export const parseQuery = (input: string): PaletteQuery => {
  for (const [mode, prefix] of Object.entries(PREFIXES)) {
    if (input.startsWith(prefix))
      return { mode: mode as PaletteMode, text: input.slice(prefix.length).trim() };
  }
  return { mode: 'files', text: input.trim() };
};

/** `12`, `12:4` or `12,4`: a 1-based line and column. */
export const parseLine = (text: string): { line: number; column: number } | undefined => {
  const match = /^(\d+)(?:\s*[:,]\s*(\d+))?$/.exec(text.trim());
  if (!match) return undefined;
  const line = Number(match[1]);
  return line >= 1 ? { line, column: Math.max(Number(match[2] ?? 1), 1) } : undefined;
};

export interface Ranked<T> {
  readonly item: T;
  readonly label: string;
  readonly match: FuzzyMatch;
}

const MAX_RESULTS = 60;

/**
 * Items whose label matches the query, best first. `boost` breaks ties and orders an empty
 * query (recent actions, open files): lower comes first, undefined last.
 */
export const rank = <T>(
  items: readonly T[],
  query: string,
  label: (item: T) => string,
  boost: (item: T) => number | undefined = () => undefined,
  limit = MAX_RESULTS,
): Ranked<T>[] => {
  const ranked: (Ranked<T> & { boost: number; index: number })[] = [];
  items.forEach((item, index) => {
    const text = label(item);
    const match = fuzzyMatch(query, text);
    if (match) ranked.push({ item, label: text, match, boost: boost(item) ?? Infinity, index });
  });
  return ranked
    .sort((a, b) => b.match.score - a.match.score || a.boost - b.boost || a.index - b.index)
    .slice(0, limit)
    .map(({ item, label: text, match }) => ({ item, label: text, match }));
};

/** Actions for a query: recently run ones first when nothing is typed, and on ties. */
export const rankActions = (
  actions: readonly EditorAction[],
  query: string,
  recent: readonly string[],
): Ranked<EditorAction>[] =>
  rank(actions, query, actionLabel, (action) => {
    const index = recent.indexOf(action.id);
    return index < 0 ? undefined : index;
  });

/** Folders whose files are never what "go to file" is after. */
const NOT_LISTED = /(^|\/)(node_modules|dist|coverage|\.git|\.nanoforge|\.turbo)(\/|$)/;

export const listedFiles = (paths: readonly string[]): string[] =>
  paths.filter((path) => !NOT_LISTED.test(path)).sort((a, b) => a.localeCompare(b));

/** Files for a query: the open documents first when nothing is typed, and on ties. */
export const rankFiles = (
  paths: readonly string[],
  query: string,
  open: readonly string[],
): Ranked<string>[] =>
  rank(
    paths,
    query,
    (path) => path,
    (path) => {
      const index = open.indexOf(path);
      return index < 0 ? undefined : index;
    },
  );

export const symbolLabel = (symbol: CodeSymbol): string =>
  symbol.container ? `${symbol.container}.${symbol.name}` : symbol.name;

export const rankSymbols = (symbols: readonly CodeSymbol[], query: string): Ranked<CodeSymbol>[] =>
  rank(symbols, query, symbolLabel, () => undefined, 200);

/** Puts an action first in the recent list (the last `limit` are kept). */
export const pushRecent = (recent: readonly string[], id: string, limit = 10): string[] =>
  [id, ...recent.filter((other) => other !== id)].slice(0, limit);
