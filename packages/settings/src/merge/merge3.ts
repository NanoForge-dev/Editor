import { deepEqual } from './deep-merge';

export interface MergeConflict {
  readonly key: string;
  readonly base: unknown;
  readonly local: unknown;
  readonly remote: unknown;
}

export interface ThreeWayMerge {
  readonly values: Record<string, unknown>;
  /** Keys changed differently on both sides; `values` keeps the local side. */
  readonly conflicts: MergeConflict[];
}

/** Per key three-way merge of settings documents (missing key = unset). */
export const merge3 = (
  base: Readonly<Record<string, unknown>>,
  local: Readonly<Record<string, unknown>>,
  remote: Readonly<Record<string, unknown>>,
): ThreeWayMerge => {
  const values: Record<string, unknown> = {};
  const conflicts: MergeConflict[] = [];
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  for (const key of [...keys].sort()) {
    const b = base[key];
    const l = local[key];
    const r = remote[key];
    let merged: unknown;
    if (deepEqual(l, b)) merged = r;
    else if (deepEqual(r, b) || deepEqual(l, r)) merged = l;
    else {
      conflicts.push({ key, base: b, local: l, remote: r });
      merged = l;
    }
    if (merged !== undefined) values[key] = merged;
  }
  return { values, conflicts };
};
