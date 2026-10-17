import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { foldkit } from "@foldkit/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

// Alchemy runs Vite for the Website Worker (`Cloudflare.Website.Foldkit` in
// src/platform/cloudflare/stack.ts) and layers its Cloudflare integration on top of this config,
// in both `alchemy dev` and `alchemy deploy`.
export default defineConfig({
  // Serve under a path prefix when BASE_PATH is set (see src/platform/cloudflare/project.ts).
  base: process.env.BASE_PATH ?? "/",
  plugins: [foldkit(), tailwindcss()],
  optimizeDeps: { entries: ["src/ui/entry.ts"], include: ["effect", "effect/http"] },
  resolve: {
    alias: { "@/": fileURLToPath(new URL("./src/ui/", import.meta.url)) },
    dedupe: ["effect", "foldkit"],
  },
  server: { watch: { ignored: ["**/.alchemy/**"] } },
});
