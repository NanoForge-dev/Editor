import { afterEach, beforeEach } from 'vitest';

/**
 * Fails a test that writes to `console.error` without expecting it, like the e2e fixture fails
 * a test on an uncaught page error: a passing test that logs an error usually hides a bug. A test
 * that expects an error spies on it (`vi.spyOn(console, 'error').mockImplementation(() => {})`).
 */
const original = console.error;
let logged: unknown[][] = [];

beforeEach(() => {
  logged = [];
  console.error = (...args: unknown[]) => {
    logged.push(args);
    original(...args);
  };
});

afterEach(() => {
  const unexpected = logged;
  logged = [];
  console.error = original;
  if (unexpected.length) {
    throw new Error(
      `The test wrote ${unexpected.length} unexpected console.error line(s), the first: ${unexpected[0]!.map(String).join(' ')}`,
    );
  }
});
