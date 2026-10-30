import { describe, expect, it, vi } from 'vitest';

import { makeService } from '../fixtures/service';

vi.mock('@nanoforge-dev/editor-sdk/ui', async () => (await import('../fixtures/ui-mock')).uiMock());

describe('FileManagerService', () => {
  it('shows the folder of a selected file, the folder itself when one is selected', () => {
    const { service } = makeService();
    service.select(['src/main.ts']);
    expect(service.folder.get()).toBe('src');
    service.select(['src']);
    expect(service.folder.get()).toBe('src');
    expect(service.targetFolder('src/main.ts')).toBe('src');
    service.select([]);
    expect(service.targetFolder()).toBe('src');
  });

  it('opens a file in an editor and a folder in the grid', async () => {
    const { service, executeCommand } = makeService();
    await service.open('src/main.ts');
    expect(executeCommand).toHaveBeenCalledWith('documents.open', 'src/main.ts');
    await service.open('nf_modules');
    expect(service.folder.get()).toBe('nf_modules');
    await service.openWith('src/main.ts', { widget: 'hex', command: 'hex.open' } as never);
    expect(executeCommand).toHaveBeenCalledWith('hex.open', 'src/main.ts');
    await service.openWith('src/main.ts', { widget: 'preview' } as never);
    expect(executeCommand).toHaveBeenCalledWith('workbench.openWidget', 'preview');
  });

  it('never cuts, moves, renames or deletes installed packages', async () => {
    const { service } = makeService();
    service.copyToClipboard('cut', ['nf_modules/ball.ts']);
    expect(service.clipboard.get()).toBeUndefined();
    service.copyToClipboard('copy', ['nf_modules/ball.ts']);
    expect(service.clipboard.get()).toEqual({ mode: 'copy', paths: ['nf_modules/ball.ts'] });
    await service.move(['nf_modules/ball.ts'], 'src');
    await service.delete(['nf_modules/ball.ts']);
    expect(await service.renameTo('nf_modules/ball.ts', 'x.ts')).toBe(false);
    expect(service.operations.move).not.toHaveBeenCalled();
    expect(service.operations.delete).not.toHaveBeenCalled();
    expect(service.operations.rename).not.toHaveBeenCalled();
  });

  it('deletes one file at once, and asks before deleting a folder', async () => {
    const { service } = makeService();
    await service.delete(['src/main.ts']);
    expect(service.operations.delete).toHaveBeenCalledWith(['src/main.ts']);
    await service.delete(['src']);
    expect(service.pendingDelete.get()).toEqual(['src']);
    await service.confirmDelete(false);
    expect(service.operations.delete).toHaveBeenCalledTimes(1);
    await service.delete(['src']);
    await service.confirmDelete(true);
    expect(service.operations.delete).toHaveBeenLastCalledWith(['src']);
    expect(service.pendingDelete.get()).toBeUndefined();
  });

  it('pastes a cut once, then empties the clipboard', async () => {
    const { service } = makeService();
    service.copyToClipboard('cut', ['src/main.ts']);
    await service.paste('');
    expect(service.operations.move).toHaveBeenCalledWith(['src/main.ts'], '');
    expect(service.clipboard.get()).toBeUndefined();
    service.copyToClipboard('copy', ['src/main.ts']);
    await service.paste('src');
    expect(service.operations.copy).toHaveBeenCalledWith(['src/main.ts'], 'src');
    expect(service.clipboard.get()).toBeDefined();
  });

  it('asks a name, refusing one already taken, then creates and opens the file', async () => {
    const { service, ask, executeCommand } = makeService();
    vi.mocked(service.operations.createFile).mockResolvedValue('src/new.ts');
    ask.mockImplementation(async ({ validate }) => {
      expect(validate?.('main.ts')).toBe('main.ts already exists');
      return 'new.ts';
    });
    await service.newFile('src');
    expect(service.operations.createFile).toHaveBeenCalledWith('src', 'new.ts');
    expect(executeCommand).toHaveBeenCalledWith('documents.open', 'src/new.ts', { line: 1 });
  });

  it('reports a failed operation instead of throwing', async () => {
    const { service, logger } = makeService();
    vi.mocked(service.operations.duplicate).mockRejectedValue(new Error('disk full'));
    await service.duplicate(['src/main.ts']);
    expect(logger.warn).toHaveBeenCalledWith('A file operation failed', expect.any(Error));
    expect(await service.renameTo('src/main.ts', 'a/b')).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/cannot contain/));
    expect(await service.renameTo('src/main.ts', '..')).toBe(false);
    expect(await service.renameTo('src/main.ts', ' ')).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith('Enter a name');
  });
});
