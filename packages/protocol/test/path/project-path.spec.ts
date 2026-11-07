import { describe, expect, it } from 'vitest';

import { ProjectPath, basename, dirname, joinPath } from '../../src/path/project-path';

describe('ProjectPath', () => {
  it.each(['', 'a', 'apps/client/src/main.ts', '.nanoforge/editor/settings.json'])(
    'accepts %j',
    (path) => expect(ProjectPath.safeParse(path).success).toBe(true),
  );

  it.each(['/etc/passwd', '../x', 'a/../b', 'a/./b', 'a//b', 'a/', 'a\\b'])('rejects %j', (path) =>
    expect(ProjectPath.safeParse(path).success).toBe(false),
  );

  it('helpers', () => {
    expect(joinPath('apps/client', '/src/', 'main.ts')).toBe('apps/client/src/main.ts');
    expect(dirname('apps/client/main.ts')).toBe('apps/client');
    expect(dirname('main.ts')).toBe('');
    expect(basename('apps/client/main.ts')).toBe('main.ts');
  });
});
