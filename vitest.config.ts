import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@/": fileURLToPath(new URL("./src/ui/", import.meta.url)) },
    dedupe: ["effect", "foldkit"],
  },
  server: { watch: { ignored: ["**/repos/**"] } },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./src/ui/vitest-setup.ts"],
  },
});
