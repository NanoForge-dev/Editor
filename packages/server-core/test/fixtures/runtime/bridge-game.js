// A game speaking the editor bridge protocol like the engine's `EditorLibrary` does (runtime
// tests): it says hello in its first tick, after `main` returned.
export const main = async ({ files, env, editor }) => {
  console.log('port=' + env.PORT + ' files=' + [...files.keys()].join(','));
  if (env.CRASH) setTimeout(() => process.exit(3), 20);
  let paused = false;
  let stopped = false;
  let reported;
  let greeted = false;
  editor.fromEditor.on('pause', () => (paused = true));
  editor.fromEditor.on('resume', () => (paused = false));
  editor.fromEditor.on('stop', () => (stopped = true));
  editor.fromEditor.on('ping', (value) => editor.toEditor.emit('pong', value));
  editor.fromEditor.on('step', () => editor.toEditor.emit('stepped'));
  editor.fromEditor.on('welcome', ({ features }) => {
    if (features.frameStats) {
      editor.toEditor.emit('frame-stats', {
        windowMs: 1000,
        ticks: 60,
        tps: 60,
        tick: { avg: 1, max: 2 },
        libraries: {},
      });
    }
    if (features.logs) editor.toEditor.emit('log', { level: 'warn', message: 'from the game' });
  });
  const tick = () => {
    if (!greeted) editor.toEditor.emit('hello', { protocolVersion: 1 });
    greeted = true;
    editor.fromEditor.runEvents();
    const state = stopped ? 'stopped' : paused ? 'paused' : 'running';
    if (state !== reported) editor.toEditor.emit('state', (reported = state));
    if (!stopped) setTimeout(tick, 5);
  };
  setTimeout(tick);
};
