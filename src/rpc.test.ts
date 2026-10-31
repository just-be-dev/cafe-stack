import { afterEach, expect, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpRouter from "effect/http/HttpRouter";
import * as Layer from "effect/Layer";
import { apiRoutes } from "./api.ts";
import { GreetingName } from "./model.ts";
import { AppInfo } from "./service.ts";
import { AppClient } from "./ui/api.ts";

/** Gives a test double the full `fetch` shape, including Bun's `preconnect`. */
const fakeFetch = (
  f: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): typeof globalThis.fetch => Object.assign(f, { preconnect: globalThis.fetch.preconnect });

// The real API routes and the real typed UI client, joined in memory.
const greet = (name: string) =>
  Effect.gen(function* () {
    const server = yield* Effect.acquireRelease(
      Effect.sync(() =>
        HttpRouter.toWebHandler(apiRoutes.pipe(Layer.provideMerge(AppInfo.layer("Contract"))), {
          disableLogger: true,
        }),
      ),
      ({ dispose }) => Effect.promise(dispose),
    );
    const client = yield* AppClient;
    return yield* client.Greet({ name: GreetingName.make(name) }).pipe(
      Effect.provideService(
        FetchHttpClient.Fetch,
        fakeFetch((input, init) => server.handler(new Request(input, init))),
      ),
    );
  }).pipe(Effect.provide(AppClient.layerAt("http://app/api/rpc")));

afterEach(() => {
  vi.restoreAllMocks();
});

it.effect("the typed client and server agree on success, without outbound HTTP", () =>
  Effect.gen(function* () {
    const outbound = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Unexpected outbound HTTP"));
    expect(yield* greet("Ada")).toEqual({ message: "Hello, Ada!", app: "Contract" });
    expect(outbound).not.toHaveBeenCalled();
  }),
);

it.effect("the expected failure arrives typed and structurally recognizable", () =>
  Effect.gen(function* () {
    const outbound = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Unexpected outbound HTTP"));
    const error = yield* Effect.flip(greet("ROOT"));
    expect(error._tag).toBe("ReservedName");
    expect(error).toMatchObject({ _tag: "ReservedName", name: "ROOT" });
    expect(outbound).not.toHaveBeenCalled();
  }),
);
