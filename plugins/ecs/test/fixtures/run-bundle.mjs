// Runs a bundle with a registry that records the caller frame of each spawnEntity() (like the
// engine's live mode), and prints the sites as JSON.
const sites = [];
globalThis.registry = {
  spawnEntity() {
    const frame = new Error().stack.split('\n')[2];
    const match = /:(\d+):(\d+)\)?\s*$/.exec(frame.trim());
    sites.push({ line: Number(match[1]), column: Number(match[2]) });
  },
  addComponent() {},
};
const { main } = await import(process.argv[2]);
await main();
console.log(JSON.stringify(sites));
