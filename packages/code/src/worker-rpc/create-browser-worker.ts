import type { WorkerEndpoint } from '../service/code-service';

/** The code worker of browsers (bundled by Vite from this URL). */
export const createBrowserWorker = (): WorkerEndpoint =>
  new Worker(new URL('../worker.ts', import.meta.url), { type: 'module', name: 'nanoforge-code' });
