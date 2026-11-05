import { readFileSync } from 'node:fs';
import { z } from 'zod';

import { EnvSchema } from '../src/env/env.schema';

const SCHEMA_FILE = new URL('../src/env/env.schema.ts', import.meta.url);

/** The doc comment above each key of the schema's object, as plain lines. */
const docs = (source: string): Map<string, string[]> => {
  const found = new Map<string, string[]>();
  for (const match of source.matchAll(/\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*\n\s*(\w+):/g)) {
    const lines = match[1]!
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, '').trim())
      .filter(Boolean);
    found.set(match[2]!, lines);
  }
  return found;
};

/**
 * `.env.example` at the repository root: every variable of `EnvSchema`, with its doc comment
 * and its default, commented out. `pnpm generate:env` writes it; a test keeps it current.
 */
export const envExample = (): string => {
  const schema = z.toJSONSchema(EnvSchema, { io: 'input', unrepresentable: 'any' }) as {
    properties: Record<string, { default?: unknown }>;
  };
  const comments = docs(readFileSync(SCHEMA_FILE, 'utf8'));
  const blocks = Object.entries(schema.properties).map(([key, property]) => {
    const value = property.default === undefined ? '' : String(property.default);
    const lines = (comments.get(key) ?? []).map((line) => `# ${line.replace(/`/g, '')}`);
    return [...lines, `# ${key}=${value}`].join('\n');
  });
  return [
    '# The editor server reads these variables (Bun also loads a .env file of the folder it',
    '# starts in). Copy this file to .env and uncomment what you change.',
    '# Generated from packages/server-core/src/env/env.schema.ts: run',
    '# `pnpm --filter @nanoforge-dev/editor-server-core generate:env` after changing it.',
    '',
    blocks.join('\n\n'),
    '',
  ].join('\n');
};
