import type { CodeDiagnostic } from '@nanoforge-dev/editor-sdk';

export type Severity = CodeDiagnostic['severity'];

export interface ProblemGroup {
  /** Stable key: the file path, or `source:<name>` for problems without a file. */
  readonly key: string;
  /** Project file, when the problems are in one. */
  readonly path?: string;
  readonly label: string;
  readonly problems: readonly CodeDiagnostic[];
  readonly errors: number;
  readonly warnings: number;
}

export interface ProblemFilter {
  readonly severities: Readonly<Record<Severity, boolean>>;
  readonly query: string;
}

/** `build:apps/client` → `Build of apps/client`; other sources keep their name. */
export const sourceTitle = (source: string): string => {
  const build = /^build:(.*)$/.exec(source);
  return build ? `Build of ${build[1] || 'the project'}` : source;
};

/** `typescript 2322`, or the app for build errors. */
export const origin = (problem: CodeDiagnostic): string =>
  `${problem.source.startsWith('build:') ? 'build' : problem.source}${
    problem.code !== undefined ? ` ${problem.code}` : ''
  }`;

const count = (problems: readonly CodeDiagnostic[], severity: Severity) =>
  problems.filter((problem) => problem.severity === severity).length;

/**
 * Problems grouped by file, files in alphabetical order; problems without a file are grouped
 * under their source, first.
 */
export const groupProblems = (
  all: ReadonlyMap<string, readonly CodeDiagnostic[]>,
  filter: ProblemFilter,
): ProblemGroup[] => {
  const needle = filter.query.trim().toLowerCase();
  const keep = (problem: CodeDiagnostic) =>
    filter.severities[problem.severity] &&
    (!needle ||
      problem.message.toLowerCase().includes(needle) ||
      problem.path.toLowerCase().includes(needle) ||
      origin(problem).toLowerCase().includes(needle));
  const group = (
    key: string,
    label: string,
    problems: readonly CodeDiagnostic[],
    path?: string,
  ): ProblemGroup => ({
    key,
    label,
    ...(path !== undefined && { path }),
    problems,
    errors: count(problems, 'error'),
    warnings: count(problems, 'warning'),
  });

  const groups: ProblemGroup[] = [];
  const bySource = new Map<string, CodeDiagnostic[]>();
  for (const problem of all.get('') ?? []) {
    if (keep(problem))
      bySource.set(problem.source, [...(bySource.get(problem.source) ?? []), problem]);
  }
  for (const [source, problems] of [...bySource].sort(([a], [b]) => a.localeCompare(b)))
    groups.push(group(`source:${source}`, sourceTitle(source), problems));
  for (const path of [...all.keys()].filter(Boolean).sort((a, b) => a.localeCompare(b))) {
    const problems = all.get(path)!.filter(keep);
    if (problems.length) groups.push(group(path, path, problems, path));
  }
  return groups;
};

/** `2 errors · 1 warning`, `1 error`, or `No problems`. */
export const summary = (all: ReadonlyMap<string, readonly CodeDiagnostic[]>): string => {
  let errors = 0;
  let warnings = 0;
  for (const problems of all.values()) {
    errors += count(problems, 'error');
    warnings += count(problems, 'warning');
  }
  const parts = [
    errors && `${errors} error${errors > 1 ? 's' : ''}`,
    warnings && `${warnings} warning${warnings > 1 ? 's' : ''}`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'No problems';
};

/** 1-based line and column of an offset in a text. */
export const positionAt = (text: string, offset: number): { line: number; column: number } => {
  const before = text.slice(0, Math.max(offset, 0));
  const line = before.split('\n').length;
  return { line, column: before.length - before.lastIndexOf('\n') };
};
