import { existsSync } from 'node:fs';

import { resetLayout } from './helpers';
import { expect, test } from './test';
import { GAME } from './workspace';

/**
 * Measures, not tests: `BENCH=1 npx playwright test` prints the numbers of docs/performance.md.
 * Nothing here fails on a slow machine, except the cold start budget with `BENCH_STRICT=1`.
 */
const RUNS = 5;
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

test('startup of a project: scripts loaded, code worker cold start, components listed', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const project = existsSync(GAME) ? 'game' : 'pong';
  const rows: Record<string, number[]> = {};
  const add = (name: string, value: number) => (rows[name] ??= []).push(Math.round(value));
  let scripts: { name: string; kb: number }[] = [];

  for (let run = 0; run < RUNS; run++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const started = Date.now();
    await page.goto(`/load?path=${project}`);
    await page.waitForURL(/\/project\//);
    await expect(page.locator('[data-nf-part="screen"]')).toBeVisible();
    add('workbench shown (ms)', Date.now() - started);
    if (run === 0) await resetLayout(page);

    await page.getByRole('tab', { name: /^Components\b/ }).click();
    const components = page.getByRole('region', { name: 'Components', exact: true });
    await expect(components.getByRole('button', { name: /^C Position\b/ }).first()).toBeVisible({
      timeout: 60_000,
    });
    add('components listed (ms)', Date.now() - started);

    const switchTo = (name: string) =>
      page.evaluate(async (label) => {
        const tab = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find(
          (element) => element.textContent?.trim() === label,
        );
        if (!tab) return -1;
        const before = performance.now();
        tab.click();
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return performance.now() - before;
      }, name);
    for (const screen of ['Scene', 'Game', 'Project', 'Scene', 'Project']) {
      const time = await switchTo(screen);
      if (time >= 0) add('screen switch render (ms)', time);
    }

    const measures = await page.evaluate(() =>
      performance.getEntriesByType('measure').map((entry) => [entry.name, entry.duration] as const),
    );
    for (const [name, duration] of measures) {
      if (name === 'nf:code:ready:time') add('code worker ready (ms)', duration);
      if (name === 'nf:code:mirrored:time') add('code worker cold start (ms)', duration);
    }
    scripts = await page.evaluate(() =>
      (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
        .filter((entry) => /\.js(\?|$)/.test(entry.name))
        .map((entry) => ({
          name: new URL(entry.name).pathname.replace(/^\/_app\/immutable\//, ''),
          kb: Math.round(entry.decodedBodySize / 1024),
        })),
    );
    await context.close();
  }

  const plugins = scripts.filter((script) => script.name.startsWith('/plugins/'));
  const app = scripts.filter((script) => !script.name.startsWith('/plugins/'));
  const total = (list: typeof scripts) => list.reduce((sum, script) => sum + script.kb, 0);
  const lines = [
    `project: ${project}, ${RUNS} runs, median (min-max)`,
    ...Object.entries(rows).map(
      ([name, values]) =>
        `${name.padEnd(30)} ${median(values)} (${Math.min(...values)}-${Math.max(...values)})`,
    ),
    `app scripts: ${app.length} files, ${total(app)} KiB`,
    `plugin scripts: ${plugins.length} files, ${total(plugins)} KiB`,
    ...scripts
      .filter((script) => script.kb >= 100)
      .sort((a, b) => b.kb - a.kb)
      .map((script) => `  ${String(script.kb).padStart(6)} KiB  ${script.name}`),
    'plugins loaded at startup: ' +
      [
        ...new Set(
          plugins.map((script) => /@nanoforge\/([^/]+)/.exec(script.name)?.[1] ?? script.name),
        ),
      ]
        .sort()
        .join(', '),
  ];
  console.log(`\n${lines.join('\n')}\n`);

  const coldStart = rows['code worker cold start (ms)'];
  expect(coldStart?.length).toBe(RUNS);
  if (process.env.BENCH_STRICT) expect(median(coldStart!)).toBeLessThan(1500);
});
