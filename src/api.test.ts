import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as Layer from "effect/Layer";
import { AppInfo } from "./service.ts";
import { apiRoutes } from "./api.ts";

it.effect("health reads the supplied capability and unknown routes return JSON errors", () =>
  Effect.gen(function* () {
    const { handler } = yield* Effect.acquireRelease(
      Effect.sync(() =>
        HttpRouter.toWebHandler(
          apiRoutes.pipe(Layer.provideMerge(AppInfo.layer("Different project"))),
          { disableLogger: true },
        ),
      ),
      ({ dispose }) => Effect.promise(dispose),
    );
    const health = yield* Effect.promise(() => handler(new Request("http://app/api/health")));
    expect(health.status).toBe(200);
    expect(yield* Effect.promise(() => health.text())).toBe(
      JSON.stringify({ name: "Different project", status: "ok" }),
    );
    expect(health.headers.get("cache-control")).toBe("no-store");
    const missing = yield* Effect.promise(() => handler(new Request("http://app/api/missing")));
    expect(missing.status).toBe(404);
    expect(yield* Effect.promise(() => missing.text())).toBe(
      JSON.stringify({ error: "Not found" }),
    );
  }),
);
