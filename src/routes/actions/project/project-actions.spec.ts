import { describe, expect, it, vi } from 'vitest';

import { actions } from './+page.server';

describe('actions getSave', () => {
  it('return save', async () => {
    const session = {
      setData: vi.fn(),
      save: vi.fn(),
    };

    const event = {
      request: {
        json: vi.fn().mockResolvedValue({ path: '/tmp' }),
      },
      locals: { session },
      cookies: {},
    } as any;

    const result = (await actions.getSave(event)) as any;

    expect(result.success).toBe(true);
  });
});
