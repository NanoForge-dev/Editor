// helper.ts
var make = () => registry.spawnEntity();

// main.ts
var main = async () => {
  const terrain = registry.spawnEntity();
  for (let i = 0;i < 2; i++)
    registry.spawnEntity();
  const ball = registry.spawnEntity();
  make();
};
export {
  main
};
