import type { Page, Route } from "@playwright/test";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as Layer from "effect/Layer";
import { apiRoutes } from "../src/api.ts";
import { Info } from "../src/model.ts";
import { RPC_PATH } from "../src/rpc.ts";
import { AppInfo } from "../src/service.ts";

/** The app name the test API reports, distinct from production's so the UI visibly shows it. */
export const TEST_APP_NAME = "Browser test app";

export type ServeApiOptions = Readonly<{
  /** The Website base path the UI was built with, e.g. `/app/`. */
  basePath?: string;
  /** The AppInfo capability behind the real routes. */
  info?: Layer.Layer<AppInfo>;
}>;

/**
 * Answers the page's `<base>api/*` requests with the real `apiRoutes` from
 * `src/api.ts`, run in the test process, so request bounds, RPC decoding,
 * typed failures, and headers are the shipped ones. Like the Website edge
 * (`src/platform/cloudflare/edge.ts`), it strips the base path first.
 *
 * Returns the paths the page requested, in order.
 */
export const serveApi = async (page: Page, options: ServeApiOptions = {}) => {
  const basePath = options.basePath ?? "/";
  const info = options.info ?? AppInfo.layer(TEST_APP_NAME);
  const api = HttpRouter.toWebHandler(apiRoutes.pipe(Layer.provideMerge(info)), {
    disableLogger: true,
  });
  page.once("close", () => void api.dispose());

  const requested: Array<string> = [];
  const base = basePath.replace(/\/$/, "");
  await page.route(`**${basePath}api/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requested.push(url.pathname);
    url.pathname = url.pathname.slice(base.length);
    const response = await api.handler(
      new Request(url, {
        method: request.method(),
        headers: request.headers(),
        body: request.postData(),
      }),
    );
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
  return requested;
};

/**
 * The path the UI's RPC client posts to under a base path, e.g. `/app/api/rpc/`.
 *
 * NOTE: Effect's HTTP RPC protocol prepends the configured URL to an empty
 * request path, which adds a trailing slash. The API router and the Website
 * edge's `<base>api/*` route both accept it.
 */
export const rpcPath = (basePath = "/") => `${basePath}${RPC_PATH.slice(1)}/`;

/**
 * An AppInfo whose reads wait until `release` is called, which holds a Greet
 * call (and the UI's Loading state) open.
 */
export const gatedAppInfo = (name = TEST_APP_NAME) => {
  const gate = Promise.withResolvers<void>();
  return {
    layer: Layer.succeed(AppInfo, {
      read: Effect.promise(() => gate.promise).pipe(Effect.as(Info.make({ name, status: "ok" }))),
    }),
    release: () => gate.resolve(),
  };
};

const apiGlob = "**/api/**";

/**
 * Takes over every API call with `handle` until the returned function is
 * called. Later routes win in Playwright, so this overrides `serveApi`.
 */
const overrideApi = async (page: Page, handle: (route: Route) => Promise<void>) => {
  await page.route(apiGlob, handle);
  return () => page.unroute(apiGlob, handle);
};

/** Makes API calls fail at the network level, as when the API is down. */
export const dropApiRequests = (page: Page) => overrideApi(page, (route) => route.abort("failed"));

/** Answers API calls with a non-RPC error, as a misbehaving proxy would. */
export const answerApiWith = (page: Page, status: number) =>
  overrideApi(page, (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ error: "Service unavailable" }),
    }),
  );
