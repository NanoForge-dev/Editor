#!/usr/bin/env node
/**
 * Prints the coverage of each workspace from its last `pnpm test:coverage`
 * (`coverage/coverage-summary.json`). With `--write`, raises `coverage-floors.json` to one point
 * under today's values, never lowering a floor: coverage only goes up.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { workspaces } from './check-workspaces.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FLOORS_FILE = join(ROOT, 'coverage-floors.json');
const METRICS = ['lines', 'statements', 'functions', 'branches'];

const floors = JSON.parse(readFileSync(FLOORS_FILE, 'utf8'));
const rows = [];
for (const path of workspaces()) {
  const summary = join(ROOT, path, 'coverage/coverage-summary.json');
  if (!existsSync(summary)) continue;
  const { name } = JSON.parse(readFileSync(join(ROOT, path, 'package.json'), 'utf8'));
  const { total } = JSON.parse(readFileSync(summary, 'utf8'));
  const today = Object.fromEntries(METRICS.map((metric) => [metric, total[metric].pct]));
  rows.push({ path, ...today });
  const floor = floors[name] ?? {};
  for (const metric of METRICS)
    floor[metric] = Math.max(floor[metric] ?? 0, Math.max(0, Math.floor(today[metric]) - 1));
  floors[name] = floor;
}

console.table(rows);
if (process.argv.includes('--write')) {
  const sorted = Object.fromEntries(Object.entries(floors).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(FLOORS_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Floors written for ${rows.length} workspaces (coverage-floors.json)`);
}
