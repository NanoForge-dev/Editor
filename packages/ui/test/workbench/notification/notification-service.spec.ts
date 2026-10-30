import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationService } from '../../../src/workbench/notification/notification-service';

describe('NotificationService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('dismisses a toast after its timeout, and keeps errors', () => {
    const service = new NotificationService();
    service.notify('info', 'Saved');
    service.notify('error', 'Failed');
    vi.advanceTimersByTime(5000);
    expect(service.active.get().map((item) => item.message)).toEqual(['Failed']);
  });

  it('waits while the toasts are held, then resumes with the time left', () => {
    const service = new NotificationService();
    service.notify('info', 'Saved', { timeout: 5000 });
    vi.advanceTimersByTime(1000);
    service.hold();
    vi.advanceTimersByTime(60_000);
    expect(service.active.get()).toHaveLength(1);
    service.release();
    vi.advanceTimersByTime(3999);
    expect(service.active.get()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(service.active.get()).toHaveLength(0);
  });

  it('gives a toast at least 2 s once released', () => {
    const service = new NotificationService();
    service.notify('info', 'Saved', { timeout: 1000 });
    vi.advanceTimersByTime(900);
    service.hold();
    service.release();
    vi.advanceTimersByTime(1999);
    expect(service.active.get()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(service.active.get()).toHaveLength(0);
  });

  it('does not start the countdown of a toast shown while held', () => {
    const service = new NotificationService();
    service.hold();
    service.notify('info', 'Saved', { timeout: 3000 });
    vi.advanceTimersByTime(10_000);
    expect(service.active.get()).toHaveLength(1);
    service.release();
    vi.advanceTimersByTime(3000);
    expect(service.active.get()).toHaveLength(0);
  });
});
