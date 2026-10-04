import { spawn } from 'node:child_process';

import { Emitter, type Event } from '@nanoforge-dev/editor-kernel';

export interface ProcessOptions {
  cwd: string;
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
  /** Data written to stdin, then closed. */
  input?: string;
}

export interface OutputLine {
  readonly stream: 'stdout' | 'stderr';
  readonly text: string;
}

export interface RunningProcess {
  readonly onLine: Event<OutputLine>;
  readonly done: Promise<ProcessResult>;
  kill(): void;
}

export interface ProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Spawns a process without a shell; output is split into lines and buffered. */
export const runProcess = (
  command: string,
  args: readonly string[],
  options: ProcessOptions,
): RunningProcess => {
  const onLine = new Emitter<OutputLine>();
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ['pipe', 'pipe', 'pipe'],
    ...(options.signal && { signal: options.signal }),
  });
  const buffers = { stdout: '', stderr: '' };
  const pending = { stdout: '', stderr: '' };

  const collect = (stream: 'stdout' | 'stderr') => (chunk: Buffer) => {
    const text = chunk.toString('utf8');
    buffers[stream] += text;
    const lines = (pending[stream] + text).split(/\r?\n/);
    pending[stream] = lines.pop() ?? '';
    for (const line of lines) onLine.fire({ stream, text: line });
  };
  child.stdout.on('data', collect('stdout'));
  child.stderr.on('data', collect('stderr'));
  if (options.input !== undefined) child.stdin.end(options.input);
  else child.stdin.end();

  const done = new Promise<ProcessResult>((resolve, reject) => {
    child.on('error', (error) => {
      onLine.dispose();
      reject(error);
    });
    child.on('close', (code) => {
      for (const stream of ['stdout', 'stderr'] as const) {
        if (pending[stream]) onLine.fire({ stream, text: pending[stream] });
      }
      onLine.dispose();
      resolve({ exitCode: code ?? -1, stdout: buffers.stdout, stderr: buffers.stderr });
    });
  });

  return { onLine: onLine.event, done, kill: () => child.kill() };
};
