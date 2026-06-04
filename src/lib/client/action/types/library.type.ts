import type { InstallLibraryBody } from '$lib/server/actions/project/library/install-library.action';
import type { LibraryPackage } from '$lib/server/project/library';

export type InstallLibraryActionInput = InstallLibraryBody;

export type InstallLibraryPackageResult = LibraryPackage;
