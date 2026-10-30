#!/usr/bin/env node
/**
 * The last failed e2e test: prints its `error-context.md` (error, page snapshot, code) and
 * saves the last frame of its trace as `test-results/last-failure.jpeg`.
 */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RESULTS = join(import.meta.dirname, '../test-results');
const failures = existsSync(RESULTS)
  ? readdirSync(RESULTS)
      .map((name) => join(RESULTS, name))
      .filter((folder) => existsSync(join(folder, 'error-context.md')))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  : [];
const [last] = failures;
if (!last) {
  console.log('No failed test in test-results/.');
  process.exit(0);
}
console.log(`${failures.length} failed test(s); the last one: ${last}\n`);
console.log(readFileSync(join(last, 'error-context.md'), 'utf8'));

const trace = join(last, 'trace.zip');
if (existsSync(trace)) {
  const folder = mkdtempSync(join(tmpdir(), 'nf-trace-'));
  try {
    execFileSync('unzip', ['-q', '-o', trace, 'screencast/*', '-d', folder]);
    /** Frames are named `page@<id>-<time>.jpeg`. */
    const time = (name) => Number(/-(\d+)\.jpeg$/.exec(name)?.[1] ?? 0);
    const frames = readdirSync(join(folder, 'screencast'))
      .filter((name) => name.endsWith('.jpeg'))
      .sort((a, b) => time(a) - time(b))
      .map((name) => join(folder, 'screencast', name));
    const frame = frames.at(-1);
    if (frame) {
      const target = join(RESULTS, 'last-failure.jpeg');
      copyFileSync(frame, target);
      console.log(`Last frame: ${target}`);
    }
  } catch (error) {
    console.log(`Could not read the trace (${error.message}): npx playwright show-trace ${trace}`);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}
