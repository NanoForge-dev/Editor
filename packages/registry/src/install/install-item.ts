import semver from 'semver';

import { manifestOf, readArchive, sha256, writeFolder } from '../archive/archive';
import {
  type ItemManifest,
  ItemName,
  type ItemType,
  type RegistryItem,
  type RegistryVersion,
} from '../item/item.schema';
import { RegistryError } from '../registry/registry.exception';
import type { Registry } from '../registry/registry.type';

/** The newest version of an item that fits a range and, when given, what runs it (`engines`). */
export const pickVersion = (
  item: RegistryItem,
  range = '*',
  engines: Readonly<Record<string, string>> = {},
): RegistryVersion | undefined =>
  item.versions
    .filter(
      (version) =>
        semver.satisfies(version.version, range, { includePrerelease: false }) &&
        Object.entries(engines).every(
          ([engine, current]) =>
            !version.engines[engine] ||
            semver.satisfies(current, version.engines[engine], { includePrerelease: true }),
        ),
    )
    .sort((a, b) => semver.rcompare(a.version, b.version))[0];

export interface InstallRequest {
  readonly name: string;
  readonly version: string;
  readonly type: ItemType;
  /** The folder the item becomes: `…/@scope/name`. */
  readonly target: string;
  /** Hash the archive must have (the registry's, or the lock's). */
  readonly sha256?: string;
}

/**
 * Downloads a version and writes it as a folder. Nothing is written unless the archive has the
 * expected hash, holds only safe paths, and its manifest says the name, version and type asked
 * for.
 */
export const installItem = async (
  registry: Registry,
  request: InstallRequest,
): Promise<ItemManifest> => {
  const name = ItemName.safeParse(request.name);
  if (!name.success) throw new RegistryError('INVALID', `${request.name} is not a valid name`);
  const bytes = await registry.download(request.name, request.version);
  const hash = sha256(bytes);
  if (request.sha256 && request.sha256 !== hash) {
    throw new RegistryError(
      'INTEGRITY',
      `${request.name}@${request.version} does not have the expected content (hash mismatch)`,
    );
  }
  const files = readArchive(bytes);
  const manifest = manifestOf(files);
  if (
    manifest.name !== request.name ||
    manifest.version !== request.version ||
    manifest.type !== request.type
  ) {
    throw new RegistryError(
      'INVALID',
      `The archive of ${request.name}@${request.version} holds ${manifest.type} ${manifest.name}@${manifest.version}`,
    );
  }
  await writeFolder(files, request.target);
  return manifest;
};
