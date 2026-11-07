/** Parses a JSON file that may have comments and trailing commas (tsconfig.json). */
export const parseLooseJson = (text: string): Record<string, unknown> => {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const cleaned = text
      .replace(
        /("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
        (_match, string: string | undefined) => string ?? '',
      )
      .replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(cleaned) as Record<string, unknown>;
  }
};

const pathsOf = (text: string): Record<string, string[]> =>
  ((parseLooseJson(text).compilerOptions as { paths?: Record<string, string[]> } | undefined)
    ?.paths ?? {}) as Record<string, string[]>;

/**
 * Adds a `compilerOptions.paths` entry to a tsconfig text, keeping its comments and formatting:
 * inserted into the existing `paths` or `compilerOptions` when there is one. Falls back to
 * rewriting the JSON when the text is too unusual to edit in place.
 */
export const withPathsEntry = (text: string, pattern: string, target: string): string => {
  if (pathsOf(text)[pattern]?.[0] === target) return text;
  if (pathsOf(text)[pattern]) text = withoutPathsEntry(text, pattern);
  const entry = `${JSON.stringify(pattern)}: [${JSON.stringify(target)}]`;
  const indentOf = (offset: number) =>
    /^[ \t]*/.exec(text.slice(text.lastIndexOf('\n', offset) + 1))![0];
  const insertAfterBrace = (match: RegExpExecArray, inner: string) => {
    const brace = match.index + match[0].length;
    const empty = /^\s*\}/.test(text.slice(brace));
    const indent = `${indentOf(match.index)}  `;
    return `${text.slice(0, brace)}\n${indent}${inner}${empty ? '\n' + indentOf(match.index) : ','}${text.slice(brace)}`;
  };
  const candidates = [
    () => {
      const match = /"paths"\s*:\s*\{/.exec(text);
      return match ? insertAfterBrace(match, entry) : undefined;
    },
    () => {
      const match = /"compilerOptions"\s*:\s*\{/.exec(text);
      return match ? insertAfterBrace(match, `"paths": { ${entry} }`) : undefined;
    },
    () => {
      const match = /^\s*\{/.exec(text);
      return match
        ? insertAfterBrace(match, `"compilerOptions": { "paths": { ${entry} } }`)
        : undefined;
    },
  ];
  for (const candidate of candidates) {
    const edited = candidate();
    if (!edited) continue;
    try {
      if (pathsOf(edited)[pattern]?.[0] === target) return edited;
    } catch {}
  }
  const config = parseLooseJson(text);
  const options = (config.compilerOptions ?? {}) as Record<string, unknown>;
  const paths = (options.paths ?? {}) as Record<string, string[]>;
  config.compilerOptions = { ...options, paths: { ...paths, [pattern]: [target] } };
  return `${JSON.stringify(config, null, 2)}\n`;
};

/** Removes a `compilerOptions.paths` entry, keeping the rest of the text as it is. */
export const withoutPathsEntry = (text: string, pattern: string): string => {
  let paths: Record<string, string[]>;
  try {
    paths = pathsOf(text);
  } catch {
    return text;
  }
  if (!(pattern in paths)) return text;
  const key = JSON.stringify(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const entry = new RegExp(`[ \\t]*${key}\\s*:\\s*\\[[^\\]]*\\][ \\t]*(,?)[ \\t]*\\r?\\n?`);
  const match = entry.exec(text);
  if (match) {
    let before = text.slice(0, match.index);
    if (!match[1]) before = before.replace(/,(\s*)$/, '$1');
    const edited = before + text.slice(match.index + match[0].length);
    try {
      if (!(pattern in pathsOf(edited))) return edited;
    } catch {}
  }
  const config = parseLooseJson(text);
  const options = (config.compilerOptions ?? {}) as Record<string, unknown>;
  const rest = Object.fromEntries(
    Object.entries((options.paths ?? {}) as Record<string, string[]>).filter(
      ([key]) => key !== pattern,
    ),
  );
  config.compilerOptions = { ...options, paths: rest };
  return `${JSON.stringify(config, null, 2)}\n`;
};
