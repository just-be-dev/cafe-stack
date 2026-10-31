import { expect, test } from "@playwright/test";
import { TEST_APP_NAME, rpcPath, serveApi } from "./api.ts";
import { BASE_PATH } from "./constant.ts";
import { applySiteHeaders, assertLoadedCleanly, submitGreeting } from "./page.ts";

// Runs against a build made with BASE_PATH (see playwright.config.ts).

test("under BASE_PATH, assets load from the base and the RPC client posts to <base>api/rpc", async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? "").origin;
  const paths: Array<string> = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === origin) paths.push(url.pathname);
  });
  await applySiteHeaders(page);
  const requested = await serveApi(page, { basePath: BASE_PATH });
  await assertLoadedCleanly(page);
  expect(new URL(page.url()).pathname).toBe(BASE_PATH);

  const rpcRequest = page.waitForRequest((request) => request.method() === "POST");
  await submitGreeting(page, "Ada");
  expect(new URL((await rpcRequest).url()).pathname).toBe(rpcPath(BASE_PATH));
  await expect(page.getByText(`Hello, Ada! (from ${TEST_APP_NAME})`)).toBeVisible();
  expect(requested).toEqual([rpcPath(BASE_PATH)]);
  expect(paths.filter((path) => !path.startsWith(BASE_PATH))).toEqual([]);
});
