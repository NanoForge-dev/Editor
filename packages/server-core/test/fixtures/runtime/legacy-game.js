// A game built against an engine without the editor bridge: it never says hello or reports
// its state, and ignores editor commands (runtime tests).
export const main = async ({ env }) => {
  console.log('legacy port=' + env.PORT);
  setInterval(() => undefined, 1000).unref?.();
};
