import { describe, expect, it } from 'vitest';

import { rewriteSharedImports } from '../../src/rewrite/rewrite-shared-imports';

const L = (s: string) => `globalThis["__nanoforge_editor_shared__"].require("${s}")`;

describe('rewriteSharedImports', () => {
  it('returns null when no shared module is imported', async () => {
    expect(await rewriteSharedImports(`import x from './x.js'; x();`)).toBeNull();
  });

  it('rewrites namespace imports (compiled svelte components)', async () => {
    const out = await rewriteSharedImports(`import * as $ from 'svelte/internal/client';\n$.x();`);
    expect(out).toBe(`const $ = ${L('svelte/internal/client')};;\n$.x();`);
  });

  it('rewrites named, aliased and default imports', async () => {
    const out = await rewriteSharedImports(
      `import sdk, { mount as m, onMount } from "@nanoforge-dev/editor-sdk";`,
    );
    expect(out).toContain(`const sdk = ${L('@nanoforge-dev/editor-sdk')}.default;`);
    expect(out).toContain(`const { mount: m, onMount } = ${L('@nanoforge-dev/editor-sdk')};`);
  });

  it('handles minified output', async () => {
    const out = await rewriteSharedImports(
      `import"svelte/internal/disclose-version";import*as e from"svelte/internal/client";import{writable as t}from"svelte/store";e.a(t);`,
    );
    expect(out).toBe(
      `;const e = ${L('svelte/internal/client')};;const { writable: t } = ${L('svelte/store')};;e.a(t);`,
    );
  });

  it('rewrites dynamic imports', async () => {
    const out = await rewriteSharedImports(`const s = await import('svelte/store');`);
    expect(out).toBe(`const s = await Promise.resolve(${L('svelte/store')});`);
  });

  it('keeps non shared imports untouched', async () => {
    const out = await rewriteSharedImports(`import a from './a.js';import{b}from"svelte";`);
    expect(out).toBe(`import a from './a.js';const { b } = ${L('svelte')};;`);
  });

  it('rejects legacy mode components', async () => {
    await expect(rewriteSharedImports(`import 'svelte/internal/flags/legacy';`)).rejects.toThrow(
      /runes mode/,
    );
  });

  it('rejects re-exports of shared modules', async () => {
    await expect(rewriteSharedImports(`export { mount } from 'svelte';`)).rejects.toThrow(
      /Re-exporting shared module/,
    );
  });
});
