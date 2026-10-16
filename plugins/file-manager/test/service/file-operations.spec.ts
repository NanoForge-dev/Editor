import { describe, expect, it } from 'vitest';

import type { HistoryCommand } from '@nanoforge-dev/editor-sdk';

import { FileOperations } from '../../src/service/file-operations';

/** Files of a fake project, by path; `failOn` makes that rename or copy throw. */
const setup = (paths: string[], failOn?: string) => {
  const files = new Set(paths);
  const fs = {
    entry: (path: string) => (files.has(path) ? { path } : undefined),
    rename: async (from: string, to: string) => {
      if (from === failOn) throw new Error(`cannot move ${from}`);
      for (const path of [...files]) {
        if (path === from || path.startsWith(`${from}/`)) {
          files.delete(path);
          files.add(to + path.slice(from.length));
        }
      }
    },
    copy: async (from: string, to: string) => {
      if (from === failOn) throw new Error(`cannot copy ${from}`);
      files.add(to);
    },
    delete: async (path: string) => {
      files.delete(path);
      return { trashPath: `.trash/${path}` };
    },
  };
  const recorded: HistoryCommand[] = [];
  const history = {
    stack: {
      push: async (command: HistoryCommand) => {
        await command.do();
        recorded.push(command);
      },
    },
  };
  const operations = new FileOperations({ fs } as never, history as never);
  return { operations, files, recorded };
};

describe('FileOperations', () => {
  it('undoes the moves already done when one fails, and records nothing', async () => {
    const { operations, files, recorded } = setup(['a.ts', 'b.ts', 'c.ts', 'dest'], 'b.ts');
    await expect(operations.move(['a.ts', 'b.ts', 'c.ts'], 'dest')).rejects.toThrow(
      'cannot move b.ts',
    );
    expect([...files].sort()).toEqual(['a.ts', 'b.ts', 'c.ts', 'dest']);
    expect(recorded).toEqual([]);
  });

  it('moves a folder selected with one of its own files as the folder only', async () => {
    const { operations, files } = setup(['src', 'src/main.ts', 'dest']);
    expect(await operations.move(['src', 'src/main.ts'], 'dest')).toEqual(['dest/src']);
    expect([...files].sort()).toEqual(['dest', 'dest/src', 'dest/src/main.ts']);
  });

  it('removes the copies already made when one fails', async () => {
    const { operations, files } = setup(['a.ts', 'b.ts', 'dest'], 'b.ts');
    await expect(operations.copy(['a.ts', 'b.ts'], 'dest')).rejects.toThrow('cannot copy b.ts');
    expect([...files].sort()).toEqual(['a.ts', 'b.ts', 'dest']);
  });
});
