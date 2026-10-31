import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as Layer from "effect/Layer";
import { apiRoutes } from "./api.ts";
import { MAX_RPC_REQUEST_BYTES } from "./rpc.ts";
import { AppInfo } from "./service.ts";

const makeHandler = Effect.acquireRelease(
  Effect.sync(() =>
    HttpRouter.toWebHandler(
      apiRoutes.pipe(Layer.provideMerge(AppInfo.layer("Different project"))),
      { disableLogger: true },
    ),
  ),
  ({ dispose }) => Effect.promise(dispose),
).pipe(
  Effect.map(
    ({ handler }) =>
      (request: Request) =>
        Effect.promise(() => handler(request)),
  ),
);

const rpcBody = (tag: string, payload: unknown) =>
  JSON.stringify({ _tag: "Request", id: "1", tag, payload, headers: [] });

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request("http://app/api/rpc", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });

/** A valid Greet request padded with JSON whitespace to exactly `size` bytes. */
const greetOfSize = (size: number) => {
  const body = rpcBody("Greet", { name: "Ada" });
  return `${body}${" ".repeat(size - new TextEncoder().encode(body).length)}`;
};

const expectApiHeaders = (response: Response) => {
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
};

it.effect("health reads the supplied capability and unknown routes return JSON errors", () =>
  Effect.gen(function* () {
    const handle = yield* makeHandler;
    const health = yield* handle(new Request("http://app/api/health"));
    expect(health.status).toBe(200);
    expect(yield* Effect.promise(() => health.text())).toBe(
      JSON.stringify({ name: "Different project", status: "ok" }),
    );
    expect(health.headers.get("cache-control")).toBe("no-store");
    const missing = yield* handle(new Request("http://app/api/missing"));
    expect(missing.status).toBe(404);
    expect(yield* Effect.promise(() => missing.text())).toBe(
      JSON.stringify({ error: "Not found" }),
    );
  }),
);

describe("POST /api/rpc", () => {
  it.effect("answers a valid request and encodes the typed failure", () =>
    Effect.gen(function* () {
      const handle = yield* makeHandler;
      const ok = yield* handle(post(rpcBody("Greet", { name: "Ada" })));
      expect(ok.status).toBe(200);
      expectApiHeaders(ok);
      expect(yield* Effect.promise(() => ok.json())).toEqual([
        {
          _tag: "Exit",
          requestId: "1",
          exit: {
            _tag: "Success",
            value: { message: "Hello, Ada!", app: "Different project" },
          },
        },
      ]);
      const reserved = yield* handle(post(rpcBody("Greet", { name: "Admin" })));
      expect(yield* Effect.promise(() => reserved.json())).toEqual([
        {
          _tag: "Exit",
          requestId: "1",
          exit: {
            _tag: "Failure",
            cause: [{ _tag: "Fail", error: { _tag: "ReservedName", name: "Admin" } }],
          },
        },
      ]);
    }),
  );

  it.effect.each(["", " Ada", "x".repeat(41), 42])(
    "rejects the payload name %j before the handler runs",
    (name) =>
      Effect.gen(function* () {
        const handle = yield* makeHandler;
        const response = yield* handle(post(rpcBody("Greet", { name })));
        expectApiHeaders(response);
        const text = yield* Effect.promise(() => response.text());
        expect(text).toContain('"_tag":"Die"');
        expect(text).not.toContain("Hello");
      }),
  );

  it.effect("reports unknown procedures and malformed JSON without breaking the handler", () =>
    Effect.gen(function* () {
      const handle = yield* makeHandler;
      const unknown = yield* handle(post(rpcBody("DropTables", {})));
      expect(yield* Effect.promise(() => unknown.text())).toContain(
        "Unknown request tag: DropTables",
      );
      const malformed = yield* handle(post("{"));
      expectApiHeaders(malformed);
      expect(yield* Effect.promise(() => malformed.json())).toMatchObject([
        { _tag: "Defect", defect: { name: "SyntaxError" } },
      ]);
      const after = yield* handle(post(rpcBody("Greet", { name: "Ada" })));
      expect(yield* Effect.promise(() => after.text())).toContain("Hello, Ada!");
    }),
  );

  it.effect("accepts JSON with parameters and rejects other content types with 415", () =>
    Effect.gen(function* () {
      const handle = yield* makeHandler;
      const withCharset = yield* handle(
        post(rpcBody("Greet", { name: "Ada" }), {
          "content-type": "Application/JSON; charset=utf-8",
        }),
      );
      expect(yield* Effect.promise(() => withCharset.text())).toContain("Hello, Ada!");
      for (const contentType of [
        "text/plain",
        "application/jsonp",
        "application/x-www-form-urlencoded",
      ]) {
        const response = yield* handle(
          post(rpcBody("Greet", { name: "Ada" }), { "content-type": contentType }),
        );
        expect(response.status).toBe(415);
        expectApiHeaders(response);
        expect(yield* Effect.promise(() => response.json())).toEqual({
          error: "Expected application/json",
        });
      }
    }),
  );

  it.effect("accepts a body of exactly the limit and rejects one byte more with 413", () =>
    Effect.gen(function* () {
      const handle = yield* makeHandler;
      expect(MAX_RPC_REQUEST_BYTES).toBe(32 * 1024);
      const atLimit = yield* handle(post(greetOfSize(MAX_RPC_REQUEST_BYTES)));
      expect(atLimit.status).toBe(200);
      expect(yield* Effect.promise(() => atLimit.text())).toContain("Hello, Ada!");
      const overLimit = yield* handle(post(greetOfSize(MAX_RPC_REQUEST_BYTES + 1)));
      expect(overLimit.status).toBe(413);
      expectApiHeaders(overLimit);
      expect(yield* Effect.promise(() => overLimit.json())).toEqual({
        error: "Request body too large",
      });
    }),
  );

  it.effect("counts the bytes actually sent, not the declared Content-Length", () =>
    Effect.gen(function* () {
      const handle = yield* makeHandler;
      const chunk = new TextEncoder().encode("x".repeat(1024));
      const sent = { chunks: 0 };
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          sent.chunks += 1;
          controller.enqueue(chunk);
        },
      });
      const response = yield* handle(
        new Request("http://app/api/rpc", {
          method: "POST",
          headers: { "content-type": "application/json", "content-length": "1" },
          body,
          duplex: "half",
        } as RequestInit),
      );
      expect(response.status).toBe(413);
      // An endless body is cut off just past the limit instead of read to the end.
      expect(sent.chunks).toBeLessThan(MAX_RPC_REQUEST_BYTES / chunk.length + 4);
    }),
  );

  it.effect("answers 400 when the body can't be read", () =>
    Effect.gen(function* () {
      const handle = yield* makeHandler;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(new Error("connection reset"));
        },
      });
      const response = yield* handle(
        new Request("http://app/api/rpc", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          duplex: "half",
        } as RequestInit),
      );
      expect(response.status).toBe(400);
      expectApiHeaders(response);
      expect(yield* Effect.promise(() => response.json())).toEqual({
        error: "Could not read request body",
      });
    }),
  );

  it.effect("only accepts POST", () =>
    Effect.gen(function* () {
      const handle = yield* makeHandler;
      const response = yield* handle(new Request("http://app/api/rpc"));
      expect(response.status).toBe(404);
    }),
  );
});
