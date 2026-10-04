import { describe, expect, it } from 'vitest';

import { HistoryService } from '@nanoforge-dev/editor-history';
import { Emitter } from '@nanoforge-dev/editor-kernel';

import { DOCUMENT_EDITS } from '../../src/document/document-contributions';
import { previewOf } from '../../src/document/document-preview';
import { DocumentService, documentHistoryId } from '../../src/document/document-service';
import { fingerprint } from '../../src/document/document-service';
import type { DocumentBackend } from '../../src/document/document.type';
import { matchesGlob } from '../../src/document/match-glob';

/** Files in memory, hashed by fingerprint. */
const memoryBackend = (files: Record<string, string>): DocumentBackend => ({
  onDidChange: new Emitter<readonly string[]>().event,
  read: async (uri) => ({ text: files[uri] ?? '', hash: fingerprint(files[uri] ?? '') }),
  write: async (uri, text) => {
    files[uri] = text;
    return { hash: fingerprint(text) };
  },
});

describe('document history', () => {
  it('edits in the document context, with a preview, and restores after a reload', async () => {
    const files = { 'src/main.ts': 'const a = 1;\nconst b = 2;\nconst c = 3;\n' };
    const history = new HistoryService();
    const documents = new DocumentService(memoryBackend(files), history);

    await documents.edit('src/main.ts', [{ start: 23, end: 24, text: '20' }], { label: 'Set b' });
    expect(files['src/main.ts']).toBe('const a = 1;\nconst b = 20;\nconst c = 3;\n');
    const context = history.get(documentHistoryId('src/main.ts'))!;
    const [entry] = context.stack.state.past;
    expect(entry!.command.label).toBe('Set b');
    expect(entry!.command.preview).toEqual({
      title: 'src/main.ts',
      before: 'const a = 1;\nconst b = 2;\nconst c = 3;',
      after: 'const a = 1;\nconst b = 20;\nconst c = 3;',
    });

    const serialized = entry!.command.serialize!()!;
    expect(serialized.type).toBe(DOCUMENT_EDITS);
    const reloaded = new DocumentService(memoryBackend(files), new HistoryService());
    const restored = reloaded.restoreEditCommand(
      JSON.parse(JSON.stringify(serialized.data)),
      serialized.label,
    )!;
    expect(restored.preview?.after).toContain('const b = 20;');
    expect(await restored.isValid!()).toBe(true);
    await restored.undo();
    expect(files['src/main.ts']).toBe('const a = 1;\nconst b = 2;\nconst c = 3;\n');
  });

  it('saves one open document with unsaved changes', async () => {
    const documents = new DocumentService(memoryBackend({}), new HistoryService());
    const saved: string[] = [];
    const open = (uri: string, dirty: boolean) =>
      documents.register({
        uri,
        kind: 'text',
        onDidChange: () => ({ dispose: () => undefined }),
        dirty: { get: () => dirty, subscribe: () => () => undefined },
        getText: () => '',
        applyEdits: () => [],
        save: async () => void saved.push(uri),
        revert: async () => undefined,
      });
    open('a.ts', true);
    open('b.ts', true);
    open('c.ts', false);
    await documents.save('a.ts');
    await documents.save('c.ts');
    await documents.save('closed.ts');
    expect(saved).toEqual(['a.ts']);
  });

  it('previews only the changed lines and their neighbours', () => {
    const before = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n');
    const after = before.replace('line 15', 'line fifteen');
    expect(previewOf('a.ts', before, after)).toEqual({
      title: 'a.ts',
      before: 'line 14\nline 15\nline 16',
      after: 'line 14\nline fifteen\nline 16',
    });
  });
});

describe('matchesGlob', () => {
  it('reads **/ as folders, never as part of a file name', async () => {
    const dotfiles = '**/{.*,*rc,Dockerfile,LICENSE,Makefile}';
    for (const path of ['.env', 'apps/client/.eslintrc', 'Dockerfile', 'apps/server/.prettierrc'])
      expect(matchesGlob(dotfiles, path), path).toBe(true);
    for (const path of ['logo.png', 'apps/client/assets/logo.png', 'src/main.ts'])
      expect(matchesGlob(dotfiles, path), path).toBe(false);

    expect(matchesGlob('**/*.{png,jpg}', 'logo.png')).toBe(true);
    expect(matchesGlob('**/*.{png,jpg}', 'a/b/logo.jpg')).toBe(true);
    expect(matchesGlob('src/**/*.ts', 'src/main.ts')).toBe(true);
    expect(matchesGlob('src/**/*.ts', 'src/a/b/main.ts')).toBe(true);
    expect(matchesGlob('src/*.ts', 'src/a/main.ts')).toBe(false);
  });
});
