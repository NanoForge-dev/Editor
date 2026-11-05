import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Floors = Partial<Record<'lines' | 'statements' | 'functions' | 'branches', number>>;

const FLOORS: Record<string, Floors> = JSON.parse(
  readFileSync(new URL('./coverage-floors.json', import.meta.url), 'utf8'),
);

/**
 * Coverage of the package the tests run in (vitest runs from its folder): v8, lcov for CI and
 * a summary for `scripts/coverage-floors.mjs`, failing under the package's floors in
 * `coverage-floors.json` (today's values, so coverage only goes up). Svelte files count only
 * where browser tests mount them (`svelte: true`, the kit): Node tests cannot instrument them.
 */
export const coverage = ({ svelte = false }: { svelte?: boolean } = {}) => {
  const { name } = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
  return {
    provider: 'v8' as const,
    reporter: ['text-summary', 'lcov', 'json-summary'],
    include: svelte ? ['src'] : ['src/**/*.{ts,js}'],
    exclude: ['**/*.{type,d}.ts', '**/index.ts'],
    thresholds: FLOORS[name] ?? {},
  };
};
