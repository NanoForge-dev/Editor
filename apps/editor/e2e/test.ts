import { test as base } from '@playwright/test';

export { type Locator, type Page, expect } from '@playwright/test';

/** Not failures: Monaco rejects the promises of requests it cancels (typing during a completion). */
const IGNORED = new Set(['Canceled']);

/**
 * The `test` of every spec: it fails when a page of the test throws an uncaught error
 * (a Svelte effect loop or a rejected promise doesn't break what the test looks at).
 */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ context }, use) => {
      const errors: string[] = [];
      context.on('weberror', (webError) => {
        const { message } = webError.error();
        if (!IGNORED.has(message)) errors.push(message);
      });
      await use(errors);
      base.expect(errors, 'uncaught errors in the page').toEqual([]);
    },
    { auto: true },
  ],
});
