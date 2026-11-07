import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe } from 'vitest';

import { DirectoryRegistry, serveRegistry } from '../../src';
import { type RegistryTarget, registryContract } from './registry-contract';

/**
 * Runs the registry contract. By default against `serveRegistry` over a folder, the reference
 * implementation. Against a real registry (read-only) with:
 *
 *   CONTRACT_REGISTRY_URL=https://api.staging.nanoforge.eu \
 *   CONTRACT_REGISTRY_ITEM=@scope/name \
 *   pnpm --filter @nanoforge-dev/registry test:contract
 */
const env = process.env;
let folder: string | undefined;
let reference: RegistryTarget | undefined;

const local = (): RegistryTarget => {
  if (reference) return reference;
  folder = mkdtempSync(join(tmpdir(), 'nf-registry-contract-'));
  for (const version of ['1.0.0', '1.1.0']) {
    const dir = join(folder, '@contract/shapes', version);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'nanoforge.manifest.json'),
      JSON.stringify({ type: 'package', name: '@contract/shapes', version, description: 'Shapes' }),
    );
    writeFileSync(join(dir, 'circle.ts'), 'export class Circle {}\n');
  }
  const serve = serveRegistry(new DirectoryRegistry(folder));
  return (reference = { baseUrl: 'https://registry.test', fetch: serve, item: '@contract/shapes' });
};

afterAll(() => folder && rmSync(folder, { recursive: true, force: true }));

describe(
  env.CONTRACT_REGISTRY_URL ? `registry at ${env.CONTRACT_REGISTRY_URL}` : 'registry (reference)',
  () =>
    registryContract(
      env.CONTRACT_REGISTRY_URL
        ? () => ({
            baseUrl: env.CONTRACT_REGISTRY_URL!,
            fetch: (url) => fetch(url),
            item: env.CONTRACT_REGISTRY_ITEM ?? '',
          })
        : local,
    ),
);
