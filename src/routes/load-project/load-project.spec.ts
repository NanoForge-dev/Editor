import { describe, expect, it, vi } from 'vitest';

import { actions } from './+page.server';

describe('actions.loadProject', () => {
  it('retourne success true avec un projectPath local', async () => {
    const session = {
      setData: vi.fn(),
      save: vi.fn(),
    };

    const event = {
      request: {
        json: vi.fn().mockResolvedValue({ projectPath: '/tmp' }),
      },
      locals: { session },
      cookies: {},
    } as any;

    const result = (await actions.loadProject(event)) as any;

    expect(result.success).toBe(true);
  });
});
