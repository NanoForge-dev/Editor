import { describe, expect, it } from 'vitest';

import { describeError, notifyError } from '../../../src/workbench/notification/describe-error';
import { NotificationService } from '../../../src/workbench/notification/notification-service';

const rpcError = (code: string, message: string) => Object.assign(new Error(message), { code });

describe('describeError', () => {
  it('says known errors in plain words and keeps the raw message', () => {
    const away = describeError(rpcError('UNAVAILABLE', 'Editor server unreachable: fetch failed'));
    expect(away.hint).toMatch(/can't be reached/);
    expect(away.technical).toBe('Editor server unreachable: fetch failed');
    expect(describeError(rpcError('UNAVAILABLE', 'fetch failed')).retryable).toBe(true);
    expect(describeError(new Error('Something odd')).hint).toBeUndefined();
  });

  it("keeps the server's own words when they are already plain", () => {
    const exists = describeError(rpcError('CONFLICT', 'Already exists: a.ts'));
    expect(exists.hint).toBeUndefined();
    expect(exists.retryable).toBe(false);
    const notifications = new NotificationService();
    notifyError(
      notifications,
      'The file operation failed',
      rpcError('CONFLICT', 'Already exists: a.ts'),
    );
    expect(notifications.history.get()[0]).toMatchObject({ detail: 'Already exists: a.ts' });
  });
});

describe('notifyError', () => {
  it('offers Try again only when it may work, and the raw message behind details', () => {
    const notifications = new NotificationService();
    const retry = () => undefined;
    notifyError(notifications, 'Could not save a.ts', rpcError('UNAVAILABLE', 'fetch failed'), {
      retry,
    });
    notifyError(notifications, 'Could not save a.ts', rpcError('FORBIDDEN', 'Permission denied'), {
      retry,
    });
    notifyError(notifications, 'Could not read b.ts', new Error('Unexpected token'));
    const [away, conflict, plain] = notifications.history.get().toReversed();
    expect(away).toMatchObject({ technical: 'fetch failed', actions: [{ title: 'Try again' }] });
    expect(conflict!.actions).toEqual([]);
    expect(plain).toMatchObject({ detail: 'Unexpected token' });
    expect(plain!.technical).toBeUndefined();
  });
});
