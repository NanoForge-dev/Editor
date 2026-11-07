import { describe, expect, it } from 'vitest';

import { GameClientRunner } from '../../src/client/game-client-runner';
import type { GameClientModule } from '../../src/client/game-client-runner.type';

/** A host element just good enough for the runner (no DOM in node tests). */
const host = () => {
  const element = { dataset: {}, style: {}, remove: () => undefined };
  return {
    ownerDocument: { createElement: () => element },
    append: () => undefined,
  } as unknown as HTMLElement;
};

const manifest = {
  app: 'client',
  baseUrl: '/out/client/',
  entry: 'main.js',
  version: '1',
  files: [{ path: 'main.js', hash: 'h' }],
};

describe('GameClientRunner', () => {
  it('stops a game still in its main, which reads the request at its first tick', async () => {
    let tick: (() => void) | undefined;
    const game: GameClientModule = {
      main: async ({ editor }) => {
        let stopped = false;
        editor.fromEditor.on('stop', () => (stopped = true));
        tick = () => {
          editor.fromEditor.runEvents();
          if (stopped) editor.toEditor.emit('state', 'stopped');
        };
        await new Promise(() => undefined);
      },
    };
    const runner = new GameClientRunner({
      importModule: async () => game,
      onEvent: () => undefined,
      onError: () => undefined,
      errorTarget: { addEventListener: () => undefined, removeEventListener: () => undefined },
    });
    void runner.start({
      host: host(),
      manifest: manifest as never,
      env: {},
      origin: 'http://editor.test',
    });
    await expect.poll(() => tick).toBeDefined();

    const stopping = runner.stop(1000);
    tick!();
    expect(await stopping).toBe(true);
  });
});
