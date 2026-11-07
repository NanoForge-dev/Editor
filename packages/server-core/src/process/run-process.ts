import { spawn } from 'node:child_process';

import { Emitter, type Event } from '@nanoforge-dev/editor-kernel';

import { childEnv } from './child-env';

/** Output kept per stream in `ProcessResult`; past it, lines are still emitted. */
const MAX_BUFFER = 16 * 1024 * 1024;
/** A line longer than this (binary output) is emitted in pieces. */
const MAX_LINE = 64 * 1024;

export interface ProcessOptions {
  cwd: string;
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
  /** Data written to stdin, then closed. */
  input?: string;
  /** Characters of output kept per stream (default 16 Mi). */
  maxBuffer?: number;
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
  /** Some output was not kept (`maxBuffer`). */
  readonly truncated: boolean;
}

/** Processes run in a group of their own (not on Windows): stopping one stops what it started. */
const GROUPS = process.platform !== 'win32';

/** Stops the groups still running when the editor exits: they no longer share its terminal's. */
const running = new Set<() => void>();
let stopOnExit = false;

const abortError = (signal: AbortSignal) =>
  Object.assign(new Error('The operation was aborted', { cause: signal.reason }), {
    name: 'AbortError',
  });

/**
 * Spawns a process without a shell, with the editor's environment filtered (`childEnv`); output
 * is split into lines and buffered. `kill()` and `signal` stop its whole process group: a build's
 * bundler or a package manager's scripts go with it.
 */
export const runProcess = (
  command: string,
  args: readonly string[],
  options: ProcessOptions,
): RunningProcess => {
  const onLine = new Emitter<OutputLine>();
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: childEnv(options.env),
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: GROUPS,
  });
  const kill = (signal: NodeJS.Signals = 'SIGTERM') => {
    if (!child.pid) return;
    try {
      if (GROUPS) process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch {}
  };
  const stop = () => kill('SIGKILL');
  running.add(stop);
  if (!stopOnExit) {
    stopOnExit = true;
    process.once('exit', () => {
      for (const each of running) each();
    });
  }
  const { signal } = options;
  const onAbort = () => kill();
  if (signal?.aborted) onAbort();
  else signal?.addEventListener('abort', onAbort, { once: true });
  const maxBuffer = options.maxBuffer ?? MAX_BUFFER;
  const buffers = { stdout: '', stderr: '' };
  const pending = { stdout: '', stderr: '' };
  let truncated = false;

  const collect = (stream: 'stdout' | 'stderr') => (text: string) => {
    const room = maxBuffer - buffers[stream].length;
    if (text.length > room) truncated = true;
    if (room > 0) buffers[stream] += text.length > room ? text.slice(0, room) : text;
    const lines = (pending[stream] + text).split(/\r?\n/);
    let rest = lines.pop() ?? '';
    for (const line of lines) onLine.fire({ stream, text: line });
    while (rest.length > MAX_LINE) {
      onLine.fire({ stream, text: rest.slice(0, MAX_LINE) });
      rest = rest.slice(MAX_LINE);
    }
    pending[stream] = rest;
  };
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', collect('stdout'));
  child.stderr.on('data', collect('stderr'));
  if (options.input !== undefined) child.stdin.end(options.input);
  else child.stdin.end();

  const done = new Promise<ProcessResult>((resolve, reject) => {
    const end = () => {
      running.delete(stop);
      signal?.removeEventListener('abort', onAbort);
      onLine.dispose();
    };
    child.on('error', (error) => {
      end();
      reject(error);
    });
    child.on('close', (code) => {
      for (const stream of ['stdout', 'stderr'] as const) {
        if (pending[stream]) onLine.fire({ stream, text: pending[stream] });
      }
      end();
      if (signal?.aborted) {
        kill();
        reject(abortError(signal));
        return;
      }
      resolve({
        exitCode: code ?? -1,
        stdout: buffers.stdout,
        stderr: buffers.stderr,
        truncated,
      });
    });
  });

  return { onLine: onLine.event, done, kill: () => kill() };
};
