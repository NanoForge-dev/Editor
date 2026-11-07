import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Formatter } from '../../src/project/formatter';

let root: string;
let local: string;
const SOURCE = 'const a = {b:"c"}\n';

beforeAll(() => {
  root = mkdtempSync(join(import.meta.dirname, '../.tmp-format-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, '.prettierrc.yaml'), 'semi: false\nplugins: ["./evil.js"]\n');
  writeFileSync(join(root, '.prettierignore'), 'src/ignored.ts\n');
  local = join(root, 'local');
  mkdirSync(join(local, 'node_modules'), { recursive: true });
  const prettier = dirname(createRequire(import.meta.url).resolve('prettier/package.json'));
  symlinkSync(realpathSync(prettier), join(local, 'node_modules/prettier'));
  writeFileSync(join(local, 'prettier.config.js'), 'export default { singleQuote: true };\n');
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('Formatter', () => {
  it("uses the project's Prettier and code config on local editors", async () => {
    const result = await new Formatter('project').format(local, join(local, 'a.ts'), SOURCE);
    expect(result).toEqual({ text: "const a = { b: 'c' };\n", formatter: 'project' });
  });

  it('uses the bundled Prettier and only static configs, without plugins, on hosted editors', async () => {
    const result = await new Formatter('static').format(root, join(root, 'src/a.ts'), SOURCE);
    expect(result).toEqual({ text: 'const a = { b: "c" }\n', formatter: 'bundled' });
  });

  it('falls back to the bundled Prettier when the project has none', async () => {
    const bare = mkdtempSync(join(tmpdir(), 'nf-format-'));
    const result = await new Formatter('project').format(bare, join(bare, 'a.ts'), SOURCE);
    expect(result).toEqual({ text: 'const a = { b: "c" };\n', formatter: 'bundled' });
    rmSync(bare, { recursive: true, force: true });
  });

  it('leaves ignored and unknown files untouched', async () => {
    const formatter = new Formatter('static');
    expect(await formatter.format(root, join(root, 'src/ignored.ts'), SOURCE)).toEqual({
      text: SOURCE,
      formatter: 'none',
    });
    expect((await formatter.format(root, join(root, 'notes.unknown'), 'x')).formatter).toBe('none');
  });

  it('reports syntax errors', async () => {
    await expect(
      new Formatter('static').format(root, join(root, 'src/a.ts'), 'const = ;'),
    ).rejects.toThrow('Prettier could not format the file');
  });
});
