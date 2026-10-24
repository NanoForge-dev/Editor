import type { GitChange, GitFile, GitStatus } from '@nanoforge-dev/editor-protocol';

export const CHANGES: Record<string, GitChange> = {
  M: 'M',
  T: 'M',
  A: 'A',
  D: 'D',
  R: 'R',
  C: 'A',
};

/** Reads `git status --porcelain=v2 --branch -z`. */
export const parseStatus = (output: string): Omit<GitStatus, 'merging'> => {
  const status: Omit<GitStatus, 'merging'> = {
    repository: true,
    ahead: 0,
    behind: 0,
    files: [],
  };
  const files: GitFile[] = [];
  const entries = output.split('\0');
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]!;
    if (!entry) continue;
    if (entry.startsWith('# branch.head ')) {
      const name = entry.slice('# branch.head '.length);
      if (name !== '(detached)') status.branch = name;
    } else if (entry.startsWith('# branch.oid ')) {
      const oid = entry.slice('# branch.oid '.length);
      if (oid !== '(initial)') status.head = oid.slice(0, 7);
    } else if (entry.startsWith('# branch.upstream ')) {
      status.upstream = entry.slice('# branch.upstream '.length);
    } else if (entry.startsWith('# branch.ab ')) {
      const match = /\+(\d+) -(\d+)/.exec(entry);
      status.ahead = Number(match?.[1] ?? 0);
      status.behind = Number(match?.[2] ?? 0);
    } else if (entry.startsWith('? ')) {
      files.push({ path: entry.slice(2), unstaged: 'U', conflicted: false });
    } else if (entry.startsWith('u ')) {
      files.push({ path: entry.split(' ').slice(10).join(' '), conflicted: true });
    } else if (entry.startsWith('1 ') || entry.startsWith('2 ')) {
      const renamed = entry.startsWith('2 ');
      const fields = entry.split(' ');
      const [x, y] = fields[1]!;
      const staged = CHANGES[x!];
      const unstaged = CHANGES[y!];
      files.push({
        path: fields.slice(renamed ? 9 : 8).join(' '),
        ...(renamed && { from: entries[++index] ?? '' }),
        ...(staged && { staged }),
        ...(unstaged && { unstaged }),
        conflicted: false,
      });
    }
  }
  return { ...status, files: files.sort((a, b) => a.path.localeCompare(b.path)) };
};
