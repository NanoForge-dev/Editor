import { test as base } from '@playwright/test';

export { type Locator, type Page, expect } from '@playwright/test';

/** Not failures: Monaco rejects the promises of requests it cancels (typing during a completion). */
const IGNORED = new Set(['Canceled']);

/**
 * The `test` of every spec: it fails when a page of the test throws an uncaught error
 * (a Svelte effect loop or a rejected promise doesn't break what the test looks at), or when its
 * Content Security Policy blocks something.
 */
export const test = base.extend<{ pageErrors: string[]; stopsTheGame: undefined }>({
  pageErrors: [
    async ({ context }, use) => {
      const errors: string[] = [];
      if (process.env.E2E_CONSOLE)
        context.on('console', (message) =>
          console.log(`[page ${message.type()}] ${message.text()}`),
        );
      /** The page's Content Security Policy blocked something the editor or a game needed. */
      context.on('console', (message) => {
        if (message.type() === 'error' && /Content Security Policy/.test(message.text()))
          errors.push(message.text());
      });
      context.on('weberror', (webError) => {
        const { message, stack } = webError.error();
        if (IGNORED.has(message)) return;
        /** `E2E_STACKS=1`: where it was thrown, for errors that only show in a full run. */
        errors.push(process.env.E2E_STACKS && stack ? `${message}\n${stack}` : message);
      });
      await use(errors);
      base.expect(errors, 'uncaught errors in the page').toEqual([]);
    },
    { auto: true },
  ],
  /**
   * A game still playing when a test ends keeps its server running on the editor's server, and
   * the next test's game then fails to start: every test stops the game it left playing.
   */
  stopsTheGame: [
    async ({ page }, use) => {
      await use(undefined);
      const run = page.getByRole('toolbar', { name: 'Run' });
      const stop = run.getByRole('button', { name: /^Stop/ });
      if (!(await stop.isVisible().catch(() => false))) return;
      await stop.click({ timeout: 5_000 }).catch(() => undefined);
      await base
        .expect(run.getByRole('button', { name: /^Play/ }))
        .toBeVisible({ timeout: 15_000 })
        .catch(() => undefined);
    },
    { auto: true },
  ],
});
