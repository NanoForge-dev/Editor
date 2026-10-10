import { describe, expect, it } from 'vitest';

import { WorkerFailedError, wrap } from '../../src/worker-rpc/worker-rpc';

/** A worker that never answers, and can crash. */
class SilentWorker extends EventTarget {
  postMessage(): void {}
  crash(): void {
    this.dispatchEvent(Object.assign(new Event('error'), { message: 'out of memory' }));
  }
}

describe('wrap', () => {
  it('fails pending calls when the worker crashes', async () => {
    const worker = new SilentWorker();
    const remote = wrap<{ diagnostics(): string[] }>(worker as never);
    const call = remote.diagnostics();
    worker.crash();
    await expect(call).rejects.toBeInstanceOf(WorkerFailedError);
    await expect(call).rejects.toThrow(/out of memory/);
  });

  it('fails a call that gets no answer in time', async () => {
    const remote = wrap<{ diagnostics(): string[] }>(new SilentWorker() as never, {
      timeoutMs: 10,
    });
    await expect(remote.diagnostics()).rejects.toThrow(/did not answer diagnostics/);
  });
});
