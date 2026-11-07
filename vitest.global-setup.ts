import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Test workspaces live in `packages/server-core/test/.tmp-*` (inside the repository, so the games
 * and plugins they hold resolve its `node_modules`). Each spec removes its own; a run that was
 * interrupted leaves them behind. Remove those older than a day: younger ones may belong to a
 * package running in parallel.
 */
export default function removeStaleWorkspaces(): void {
  const folder = join(import.meta.dirname, 'packages/server-core/test');
  const limit = Date.now() - 24 * 60 * 60 * 1000;
  for (const name of readdirSync(folder)) {
    if (!name.startsWith('.tmp-')) continue;
    const path = join(folder, name);
    try {
      if (statSync(path).mtimeMs < limit) rmSync(path, { recursive: true, force: true });
    } catch {}
  }
}
