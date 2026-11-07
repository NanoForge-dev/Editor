import { describe, expect, it } from 'vitest';

import { DiagnosticsService } from '../../src';
import type { CodeDiagnostic } from '../../src/engine/engine.type';

const problem = (path: string, message: string): CodeDiagnostic => ({
  path,
  start: 0,
  length: 1,
  line: 1,
  column: 1,
  message,
  severity: 'error',
  source: 'typescript',
});

describe('DiagnosticsService', () => {
  it('publishes several files at once, and nothing when no file changed', () => {
    const service = new DiagnosticsService();
    let published = 0;
    const subscription = service.all.subscribe(() => published++);
    const before = published;
    service.setMany(
      'typescript',
      new Map([
        ['a.ts', [problem('a.ts', 'one')]],
        ['b.ts', [problem('b.ts', 'two')]],
      ]),
    );
    expect(published - before).toBe(1);
    expect([...service.all.get().keys()]).toEqual(['a.ts', 'b.ts']);
    service.setMany('typescript', new Map([['a.ts', [problem('a.ts', 'one')]]]));
    expect(published - before).toBe(1);
    service.set('typescript', 'a.ts', []);
    expect(published - before).toBe(2);
    expect([...service.all.get().keys()]).toEqual(['b.ts']);
    subscription();
  });
});
