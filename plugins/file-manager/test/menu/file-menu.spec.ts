import { describe, expect, it, vi } from 'vitest';

import { fileMenu, newEntries } from '../../src/menu/file-menu';
import { makeService } from '../fixtures/service';

vi.mock('@nanoforge-dev/editor-sdk/ui', async () => (await import('../fixtures/ui-mock')).uiMock());

type Entry = { kind: string; id?: string; label?: string; disabled?: boolean; items?: Entry[] };
const ids = (entries: readonly Entry[]) =>
  entries.flatMap((entry) => (entry.kind === 'item' ? [entry.id] : []));

describe('file menu', () => {
  it('offers to open, create, edit and download a file', () => {
    const { service, contextKeys, executeCommand } = makeService();
    const menu = fileMenu(
      service,
      ['src/main.ts'],
      contextKeys,
      { getValues: () => [] },
      executeCommand,
    );
    expect(ids(menu)).toEqual([
      'open',
      'import',
      'cut',
      'copy',
      'paste',
      'duplicate',
      'rename',
      'delete',
      'reveal',
      'download',
      'copy-path',
    ]);
    expect(menu.find((entry) => entry.kind === 'item' && entry.id === 'paste')).toMatchObject({
      disabled: true,
    });
  });

  it('only reads installed packages', () => {
    const { service, contextKeys, executeCommand } = makeService(undefined, undefined, {
      local: false,
    });
    const menu = fileMenu(
      service,
      ['nf_modules/ball.ts'],
      contextKeys,
      { getValues: () => [] },
      executeCommand,
    );
    expect(ids(menu)).toEqual(['open', 'cut', 'copy', 'paste', 'download', 'copy-path']);
    expect(menu.find((entry) => entry.kind === 'item' && entry.id === 'cut')).toMatchObject({
      disabled: true,
    });
  });

  it('adds the contributed actions whose when clause holds, in group order', () => {
    const { service, contextKeys, executeCommand } = makeService();
    const actions = [
      { id: 'b', title: 'Second', command: 'x.b', group: 'b', when: 'fileKind == file' },
      { id: 'a', title: 'First', command: 'x.a', group: 'a', when: "fileExtname == '.ts'" },
      { id: 'c', title: 'Folders only', command: 'x.c', when: 'fileKind == directory' },
    ];
    const menu = fileMenu(
      service,
      ['src/main.ts'],
      contextKeys,
      { getValues: () => actions as never[] },
      executeCommand,
    );
    const labels = menu.flatMap((entry) => ('label' in entry ? [entry.label] : []));
    expect(labels).toContain('First');
    expect(labels).toContain('Second');
    expect(labels).not.toContain('Folders only');
    expect(labels.indexOf('First')).toBeLessThan(labels.indexOf('Second'));
  });

  it('groups the contributed templates by category under New', () => {
    const { service } = makeService(undefined, {
      'files.templates': [
        { id: 'component', title: 'Component', category: 'ECS', icon: 'box' },
        { id: 'system', title: 'System', category: 'ECS' },
        { id: 'readme', title: 'Readme' },
      ],
    });
    const entries = newEntries(service, 'src') as Entry[];
    expect(entries.map((entry) => entry.label ?? entry.kind)).toEqual([
      'File…',
      'Folder…',
      'separator',
      'Component…',
      'System…',
      'separator',
      'Readme…',
    ]);
  });
});
