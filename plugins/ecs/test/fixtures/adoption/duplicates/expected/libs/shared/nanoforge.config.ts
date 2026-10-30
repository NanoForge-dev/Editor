import { defineConfig } from "@nanoforge-dev/config";

export default defineConfig({
  type: "lib",
  dir: { components: "src/components", systems: "src/systems", scenes: "src/scenes" },
});
