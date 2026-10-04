import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type { FileChange } from '@nanoforge-dev/editor-protocol';

import { ProjectFileSystem } from '../../src/fs/fs-service';
import { ProjectWatcher } from '../../src/fs/watcher';
import { sha1 } from '../../src/util/hash';

const roots: string[] = [];
const project = () => {
  const root = mkdtempSync(join(tmpdir(), 'nf-fs-'));
  roots.push(root);
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/main.ts'), 'export {};\n');
  return { root, fs: new ProjectFileSystem(root) };
};
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('ProjectFileSystem', () => {
  it('reads, stats and lists', async () => {
    const { fs } = project();
    const file = await fs.read('src/main.ts');
    expect(new TextDecoder().decode(file.content)).toBe('export {};\n');
    expect(file.hash).toBe(sha1('export {};\n'));
    expect(await fs.stat('missing')).toBeNull();
    expect((await fs.list('', true)).map((e) => [e.path, e.kind])).toEqual([
      ['src', 'directory'],
      ['src/main.ts', 'file'],
    ]);
  });

  it('writes atomically with optimistic concurrency', async () => {
    const { root, fs } = project();
    const { hash } = await fs.read('src/main.ts');
    const written = await fs.write('src/main.ts', 'export const a = 1;\n', { expectedHash: hash });
    expect(readFileSync(join(root, 'src/main.ts'), 'utf8')).toBe('export const a = 1;\n');
    await expect(fs.write('src/main.ts', 'x', { expectedHash: hash })).rejects.toMatchObject({
      code: 'CONFLICT',
      data: { hash: written.hash },
    });
    await expect(fs.write('src/new.ts', 'x', { expectedHash: 'abc' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await fs.write('deep/new/file.ts', 'x', { expectedHash: null });
    expect(readdirSync(join(root, 'src')).some((name) => name.includes('.nf-'))).toBe(false);
  });

  it('jails paths, including through symlinks', async () => {
    const { root, fs } = project();
    const outside = mkdtempSync(join(tmpdir(), 'nf-outside-'));
    roots.push(outside);
    writeFileSync(join(outside, 'secret'), 'x');
    symlinkSync(outside, join(root, 'link'));
    await expect(fs.read('../etc/passwd')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(fs.read('link/secret')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(fs.write('link/new', 'x')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('moves deleted entries to the trash', async () => {
    const { root, fs } = project();
    await fs.delete('src/main.ts');
    expect(existsSync(join(root, 'src/main.ts'))).toBe(false);
    const trash = readdirSync(join(root, '.nanoforge/editor/trash'));
    expect(trash).toHaveLength(1);
    expect(trash[0]).toMatch(/main\.ts$/);
    expect(readFileSync(join(root, '.nanoforge/editor/.gitignore'), 'utf8')).toContain('trash/');
    await expect(fs.delete('')).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('renames and copies without overwriting by default', async () => {
    const { fs } = project();
    await fs.copy('src/main.ts', 'src/copy.ts');
    await expect(fs.copy('src/main.ts', 'src/copy.ts')).rejects.toMatchObject({ code: 'CONFLICT' });
    await fs.rename('src/copy.ts', 'lib/moved.ts');
    expect(await fs.stat('lib/moved.ts')).toMatchObject({ kind: 'file' });
    await expect(fs.rename('missing', 'x')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('ProjectFileSystem packages, ignore and trash', () => {
  it('hides .nfignore entries from listings', async () => {
    const { root, fs } = project();
    mkdirSync(join(root, 'generated'));
    writeFileSync(join(root, 'generated/out.ts'), '');
    writeFileSync(join(root, 'src/secret.ts'), '');
    writeFileSync(join(root, '.nfignore'), '# hidden\ngenerated/\nsrc/secret.ts\n');
    const paths = (await fs.list('', true)).map((entry) => entry.path);
    expect(paths).toContain('.nfignore');
    expect(paths).toContain('src/main.ts');
    expect(paths.filter((path) => path.includes('generated') || path.includes('secret'))).toEqual(
      [],
    );
    expect(fs.isIgnored('generated', true)).toBe(true);
    expect(fs.isIgnored('src/main.ts', false)).toBe(false);
  });

  it('never changes installed packages (nf_modules)', async () => {
    const { root, fs } = project();
    mkdirSync(join(root, 'nf_modules/physics'), { recursive: true });
    writeFileSync(join(root, 'nf_modules/physics/body.ts'), 'export {};\n');
    await expect(fs.write('nf_modules/physics/body.ts', 'x')).rejects.toThrow('cannot be changed');
    await expect(fs.delete('nf_modules/physics')).rejects.toThrow('cannot be changed');
    await expect(fs.rename('src/main.ts', 'nf_modules/main.ts')).rejects.toThrow(
      'cannot be changed',
    );
    await fs.copy('nf_modules/physics/body.ts', 'src/body.ts');
    expect(readFileSync(join(root, 'src/body.ts'), 'utf8')).toBe('export {};\n');
  });

  it('restores deleted entries from the trash', async () => {
    const { root, fs } = project();
    const { trashPath } = await fs.delete('src/main.ts');
    expect(existsSync(join(root, 'src/main.ts'))).toBe(false);
    await fs.restore(trashPath, 'src/main.ts');
    expect(readFileSync(join(root, 'src/main.ts'), 'utf8')).toBe('export {};\n');
    await expect(fs.restore('src/main.ts', 'src/other.ts')).rejects.toThrow('Not in the trash');
  });
});

describe('ProjectWatcher', () => {
  it('reports batched changes within 200 ms and ignores noise', async () => {
    const { root, fs } = project();
    mkdirSync(join(root, 'node_modules'));
    mkdirSync(join(root, 'dist'));
    const watcher = new ProjectWatcher(fs.jail, { ignoredPaths: () => ['dist'] });
    const batches: FileChange[][] = [];
    const subscription = watcher.onDidChange((changes) => batches.push(changes));
    await watcher.ready;

    const start = Date.now();
    writeFileSync(join(root, 'src/new.ts'), 'x');
    writeFileSync(join(root, 'node_modules/ignored.js'), 'x');
    writeFileSync(join(root, 'dist/main.js'), 'x');
    await fs.write('src/main.ts', 'changed');
    while (!batches.length && Date.now() - start < 1000) await new Promise((r) => setTimeout(r, 5));
    const elapsed = Date.now() - start;
    await new Promise((r) => setTimeout(r, 100));
    subscription.dispose();

    expect(elapsed).toBeLessThan(200);
    expect(batches.flat().sort((a, b) => a.path.localeCompare(b.path))).toEqual([
      { type: 'changed', kind: 'file', path: 'src/main.ts' },
      { type: 'created', kind: 'file', path: 'src/new.ts' },
    ]);
  });
});
