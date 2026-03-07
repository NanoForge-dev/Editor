import { describe, expect, it, vi } from 'vitest';

import { load } from './routes/loadProject/+page.server';

describe('load', () => {
  it('local project load and session cookie set', async () => {
    const cookies = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };

    const session = {
      setData: vi.fn(),
      save: vi.fn().mockImplementation(async () => {
        cookies.set('session', 'abc123', {
          path: '/',
          httpOnly: true,
        });
      }),
    };

    const event = {
      cookies,
      url: {
        searchParams: {
          get: (param: string) => (param === 'projectPath' ? '/tmp' : null),
        },
      },
      locals: { session },
    } as any;

    await expect(load(event)).rejects.toMatchObject({
      status: 307,
      location: '/',
    });

    expect(session.setData).toHaveBeenCalledWith({ path: '/tmp' });
    expect(cookies.set).toHaveBeenCalledWith('session', 'abc123', {
      path: '/',
      httpOnly: true,
    });
  });
});
