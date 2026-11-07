import { describe, expect, it } from 'vitest';

import { runProcess } from '../../src/process/run-process';

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const until = async (check: () => boolean, ms = 2000) => {
  const start = Date.now();
  while (!check() && Date.now() - start < ms) await new Promise((r) => setTimeout(r, 20));
  return check();
};

describe.skipIf(process.platform === 'win32')('runProcess', () => {
  it('runs a command and keeps its output', async () => {
    const result = await runProcess('sh', ['-c', 'echo out; echo err >&2; exit 3'], {
      cwd: import.meta.dirname,
    }).done;
    expect(result).toMatchObject({ exitCode: 3, stdout: 'out\n', stderr: 'err\n' });
  });

  it('stops what the process started when aborted', async () => {
    const abort = new AbortController();
    const run = runProcess('sh', ['-c', 'sleep 30 & echo $!; wait'], {
      cwd: import.meta.dirname,
      signal: abort.signal,
    });
    const started = new Promise<number>((resolve) =>
      run.onLine(({ text }) => resolve(Number(text))),
    );
    const child = await started;
    expect(alive(child)).toBe(true);
    abort.abort();
    await expect(run.done).rejects.toMatchObject({ name: 'AbortError' });
    expect(await until(() => !alive(child))).toBe(true);
  });
});
