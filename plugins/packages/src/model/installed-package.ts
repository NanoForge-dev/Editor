import type { InstalledPackage } from '@nanoforge-dev/editor-sdk';

export interface UpdateChoice {
  readonly version: string;
  /** Past the project's range: the range moves to `^version`. */
  readonly latest: boolean;
  readonly label: string;
}

/**
 * The updates to offer for an installed package: the newest version in its range, and the
 * newest of all when that is another one. A package only others need follows them: it has no
 * range of its own to move.
 */
export const updateChoices = (installed: InstalledPackage): UpdateChoice[] => {
  const choices: UpdateChoice[] = [];
  if (installed.wanted)
    choices.push({
      version: installed.wanted,
      latest: false,
      label: `Update to ${installed.wanted}`,
    });
  if (installed.latest && installed.latest !== installed.wanted && installed.range !== undefined)
    choices.push({
      version: installed.latest,
      latest: true,
      label: `Update to ${installed.latest}`,
    });
  return choices;
};

/** Why a package is in the project: asked for with a range, or brought by others. */
export const reasonOf = (installed: InstalledPackage): string =>
  installed.range !== undefined
    ? `asked for as ${installed.range}`
    : installed.dependents.length
      ? `needed by ${installed.dependents.join(', ')}`
      : 'not needed any more';

/** The lock lists them, `nf_modules` lacks them (a fresh clone). */
export const missing = (installed: readonly InstalledPackage[]): InstalledPackage[] =>
  installed.filter((entry) => !entry.present);

export const plural = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;
