import { defineConfig, devices } from "@playwright/test";
import { BASE_PATH, BASE_PATH_PORT, ROOT_PORT } from "./e2e/constant.ts";

const isCi = Boolean(process.env.CI);
const host = "127.0.0.1";

/**
 * Builds the UI into its own folder and serves it with `vite preview`. The
 * preview is static: specs answer `/api/*` with the real routes from
 * `src/api.ts` (see e2e/api.ts), so no Worker, Alchemy, or Cloudflare runs.
 */
const preview = (port: number, outDir: string) => ({
  command: `vite build --outDir ${outDir} --emptyOutDir --logLevel warn && vite preview --outDir ${outDir} --host ${host} --port ${port} --strictPort`,
  reuseExistingServer: false,
  timeout: 120_000,
  stdout: "ignore" as const,
});

const rootUrl = `http://${host}:${ROOT_PORT}/`;
const basePathUrl = `http://${host}:${BASE_PATH_PORT}${BASE_PATH}`;
const basePathSpec = "**/base-path.spec.ts";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: 0,
  reporter: isCi ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: rootUrl, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "chromium", use: devices["Desktop Chrome"], testIgnore: basePathSpec },
    { name: "webkit", use: devices["Desktop Safari"], testIgnore: basePathSpec },
    {
      name: "base-path",
      use: { ...devices["Desktop Chrome"], baseURL: basePathUrl },
      testMatch: basePathSpec,
    },
  ],
  webServer: [
    { ...preview(ROOT_PORT, "dist/e2e/root"), url: rootUrl },
    {
      ...preview(BASE_PATH_PORT, "dist/e2e/base-path"),
      url: basePathUrl,
      env: { BASE_PATH },
    },
  ],
});
