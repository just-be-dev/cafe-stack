import { describe, expect, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpRouter from "effect/http/HttpRouter";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as TestClock from "effect/testing/TestClock";
import { apiRoutes } from "../api.ts";
import { GreetingName } from "../model.ts";
import { AppInfo } from "../service.ts";
import { AppClient } from "./api.ts";
import { FetchGreeting, GreetingFailure, Message } from "./main.ts";

const ada = GreetingName.make("Ada");

/** Gives a test double the full `fetch` shape, including Bun's `preconnect`. */
const fakeFetch = (
  f: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): typeof globalThis.fetch => Object.assign(f, { preconnect: globalThis.fetch.preconnect });

/** The real API routes, served in memory with the given AppInfo. */
const serveApi = (info: Layer.Layer<AppInfo>) =>
  Effect.acquireRelease(
    Effect.sync(() =>
      HttpRouter.toWebHandler(apiRoutes.pipe(Layer.provideMerge(info)), { disableLogger: true }),
    ),
    ({ dispose }) => Effect.promise(dispose),
  ).pipe(
    Effect.map(({ handler }) => fakeFetch((input, init) => handler(new Request(input, init)))),
  );

/** A fetch that never answers and records when the client aborts it. */
const stalledFetch = Effect.gen(function* () {
  const started = yield* Deferred.make<void>();
  const aborted = yield* Deferred.make<void>();
  const fetch = fakeFetch(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            Deferred.doneUnsafe(aborted, Exit.void);
            reject(new Error("aborted"));
          },
          { once: true },
        );
        Deferred.doneUnsafe(started, Exit.void);
      }),
  );
  return { fetch, started, aborted };
});

const runGreeting = (name: GreetingName, fetch: typeof globalThis.fetch) =>
  FetchGreeting({ name }).effect.pipe(
    Effect.provide(AppClient.layerAt("http://app/api/rpc")),
    Effect.provideService(FetchHttpClient.Fetch, fetch),
  );

describe("FetchGreeting", () => {
  it.effect("turns a greeting into SucceededFetchGreeting", () =>
    Effect.gen(function* () {
      const fetch = yield* serveApi(AppInfo.layer("Starter"));
      expect(yield* runGreeting(ada, fetch)).toEqual(
        Message.SucceededFetchGreeting({ greeting: { message: "Hello, Ada!", app: "Starter" } }),
      );
    }),
  );

  it.effect("maps the typed ReservedName failure to its own failure", () =>
    Effect.gen(function* () {
      const fetch = yield* serveApi(AppInfo.layer("Starter"));
      const admin = GreetingName.make("admin");
      expect(yield* runGreeting(admin, fetch)).toEqual(
        Message.FailedFetchGreeting({ failure: GreetingFailure.ReservedName({ name: admin }) }),
      );
    }),
  );

  it.effect("logs a remote defect and reports it as Unavailable", () =>
    Effect.gen(function* () {
      const logs: Array<string> = [];
      const logger = Logger.make(({ logLevel, message }) => {
        logs.push(`${logLevel}: ${String(Array.isArray(message) ? message[0] : message)}`);
      });
      const fetch = yield* serveApi(
        Layer.succeed(AppInfo, { read: Effect.die(new Error("backend broke")) }),
      );
      const result = yield* runGreeting(ada, fetch).pipe(Effect.provide(Logger.layer([logger])));
      expect(result).toEqual(
        Message.FailedFetchGreeting({ failure: GreetingFailure.Unavailable() }),
      );
      expect(logs).toContain("Error: Greeting failed unexpectedly");
    }),
  );

  it.effect("reports a transport failure as Unavailable without logging a defect", () =>
    Effect.gen(function* () {
      const logs: Array<string> = [];
      const logger = Logger.make(({ message }) => {
        logs.push(String(message));
      });
      const offline = fakeFetch(() => Promise.reject(new TypeError("offline")));
      const result = yield* runGreeting(ada, offline).pipe(Effect.provide(Logger.layer([logger])));
      expect(result).toEqual(
        Message.FailedFetchGreeting({ failure: GreetingFailure.Unavailable() }),
      );
      expect(logs).toEqual([]);
    }),
  );

  it.effect("aborts a stalled request at the timeout and reports Unavailable", () =>
    Effect.gen(function* () {
      const { fetch, started, aborted } = yield* stalledFetch;
      const fiber = yield* Effect.forkChild(runGreeting(ada, fetch));
      yield* Deferred.await(started);
      yield* TestClock.adjust("9999 millis");
      expect(yield* Deferred.isDone(aborted)).toBe(false);
      yield* TestClock.adjust("1 millis");
      expect(yield* Fiber.join(fiber)).toEqual(
        Message.FailedFetchGreeting({ failure: GreetingFailure.Unavailable() }),
      );
      expect(yield* Deferred.isDone(aborted)).toBe(true);
    }),
  );

  it.effect("interruption aborts the request and produces no Message", () =>
    Effect.gen(function* () {
      const { fetch, started, aborted } = yield* stalledFetch;
      const fiber = yield* Effect.forkChild(runGreeting(ada, fetch));
      yield* Deferred.await(started);
      const exit = yield* Fiber.interrupt(fiber).pipe(Effect.andThen(Fiber.await(fiber)));
      expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
      expect(yield* Deferred.isDone(aborted)).toBe(true);
    }),
  );
});
