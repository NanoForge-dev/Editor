import { describe, expect, it } from 'vitest';

import { ExtensionRegistry } from '@nanoforge-dev/editor-kernel';

import { WIDGETS } from '../../../src/workbench/extension-point/widget.extension-point';
import { WorkbenchService } from '../../../src/workbench/service/workbench-service';
import type { ViewStatus } from '../../../src/workbench/service/workbench-service.type';

const setup = (activate: (event: string) => Promise<unknown>) => {
  const extensions = new ExtensionRegistry();
  extensions.contribute(WIDGETS, { id: 'demo.panel', title: 'Demo' } as never, { owner: 'demo' });
  const settings = { registry: { register: () => ({ dispose() {} }) }, get: () => ({}) };
  const service = new WorkbenchService({
    services: {} as never,
    extensions,
    styles: {} as never,
    layout: {} as never,
    contextKeys: {} as never,
    settings: settings as never,
    activate,
  });
  const statuses: ViewStatus[] = [];
  const unsubscribe = service.view('demo.panel').subscribe((status) => statuses.push(status));
  return { service, statuses, unsubscribe };
};

describe('WorkbenchService panel views', () => {
  it('says why a panel is unavailable when its plugin failed, and tries again', async () => {
    let calls = 0;
    const { service, statuses, unsubscribe } = setup(async () => {
      calls++;
      return calls === 1 ? [new Error('import failed')] : [];
    });
    await expect.poll(() => statuses.at(-1)?.kind).toBe('unavailable');
    expect(statuses.at(-1)).toMatchObject({
      reason: 'Its plugin failed to start: import failed',
    });

    service.retry('demo.panel');
    await expect.poll(() => calls).toBe(2);
    await expect
      .poll(() => (statuses.at(-1) as { reason?: string }).reason)
      .toBe('Its plugin did not register a view for this panel.');
    unsubscribe();
    service.dispose();
  });
});
