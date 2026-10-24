/** A change of the project's files, as the file system reports it. */
export interface PathChange {
  readonly type: 'created' | 'changed' | 'deleted';
  readonly path: string;
  readonly kind: 'file' | 'directory';
}

const dirname = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/**
 * Finds the renames and moves in a batch of changes. The file system only says "deleted" and
 * "created": a deleted file is taken as moved when the batch creates one file with its name
 * elsewhere, and as renamed when its folder lost one file and gained one in the same batch.
 * Anything less clear stays a deletion.
 */
export const pairRenames = (changes: readonly PathChange[]): Map<string, string> => {
  const files = (type: PathChange['type']) =>
    changes.filter((change) => change.type === type && change.kind === 'file').map((c) => c.path);
  const created = files('created');
  const deleted = files('deleted').filter((path) => !created.includes(path));
  const pairs = new Map<string, string>();
  const taken = new Set<string>();
  for (const from of deleted) {
    const sameName = created.filter((to) => basename(to) === basename(from) && !taken.has(to));
    const moved =
      sameName.length === 1
        ? sameName[0]
        : sameName
            .map((to) => ({ to, score: commonSuffix(from, to) }))
            .sort((a, b) => b.score - a.score)
            .find((candidate, index, all) => candidate.score > (all[index + 1]?.score ?? -1))?.to;
    if (moved) {
      pairs.set(from, moved);
      taken.add(moved);
    }
  }
  for (const from of deleted) {
    if (pairs.has(from)) continue;
    const here = (path: string) => dirname(path) === dirname(from);
    const gone = deleted.filter((path) => here(path) && !pairs.has(path));
    const added = created.filter((path) => here(path) && !taken.has(path));
    if (gone.length === 1 && added.length === 1) {
      pairs.set(from, added[0]!);
      taken.add(added[0]!);
    }
  }
  return pairs;
};

/** How many trailing path segments two paths share. */
const commonSuffix = (a: string, b: string): number => {
  const left = a.split('/').reverse();
  const right = b.split('/').reverse();
  let count = 0;
  while (count < left.length && left[count] === right[count]) count++;
  return count;
};
