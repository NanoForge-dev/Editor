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
      if (process.env.E2E_CONSOLE)
        context.on('console', (message) =>
          console.log(`[page ${message.type()}] ${message.text()}`),
        );
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
});
