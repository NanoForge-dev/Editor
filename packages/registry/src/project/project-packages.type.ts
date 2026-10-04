export interface InstalledPackage {
  readonly name: string;
  readonly version: string;
  /** The range the project asks for; undefined for a package only others need. */
  readonly range?: string;
  /** Installed packages that need it. */
  readonly dependents: readonly string[];
  /** Whether its folder is in `nf_modules` (false after a fresh clone: `restore`). */
  readonly present: boolean;
}

export interface OutdatedPackage extends InstalledPackage {
  /** The newest version its range allows, when newer than the installed one. */
  readonly wanted?: string;
  /** The newest version of all, when newer than the installed one. */
  readonly latest?: string;
}
