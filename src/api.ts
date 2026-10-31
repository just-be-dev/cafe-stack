import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";
import * as Stream from "effect/Stream";
import { AppRpcs, MAX_RPC_REQUEST_BYTES, RPC_PATH } from "./rpc.ts";
import { AppInfo, greet } from "./service.ts";

const apiHeaders = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

const json = (body: unknown, status = 200) =>
  HttpServerResponse.jsonUnsafe(body, { status, headers: apiHeaders });

const isJson = (contentType: string | undefined) =>
  contentType?.split(";")[0]?.trim().toLowerCase() === "application/json";

/**
 * Reads at most MAX_RPC_REQUEST_BYTES + 1 bytes of the body, whatever
 * Content-Length claims, and stops pulling once the limit is crossed.
 */
const readBoundedBody = (request: HttpServerRequest.HttpServerRequest) =>
  request.stream.pipe(
    Stream.mapAccum(
      () => 0,
      (received, chunk: Uint8Array) => [received + chunk.length, [{ received, chunk }]] as const,
    ),
    Stream.takeUntil(({ received, chunk }) => received + chunk.length > MAX_RPC_REQUEST_BYTES),
    Stream.runFold(
      () => new Uint8Array(0),
      (body, { chunk }) => {
        const size = Math.min(body.length + chunk.length, MAX_RPC_REQUEST_BYTES + 1);
        const next = new Uint8Array(size);
        next.set(body);
        next.set(chunk.subarray(0, size - body.length), body.length);
        return next;
      },
    ),
  );

/**
 * Bounds RPC requests before the RPC server decodes them: JSON only, at most
 * MAX_RPC_REQUEST_BYTES, and no caching or content sniffing of the answer.
 */
const RequestBounds = HttpRouter.middleware((httpEffect) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    if (!isJson(request.headers["content-type"])) {
      return json({ error: "Expected application/json" }, 415);
    }
    const body = yield* Effect.result(readBoundedBody(request));
    if (body._tag === "Failure") {
      return json({ error: "Could not read request body" }, 400);
    }
    if (body.success.length > MAX_RPC_REQUEST_BYTES) {
      return json({ error: "Request body too large" }, 413);
    }
    const web = yield* Effect.orDie(HttpServerRequest.toWeb(request));
    const bounded = HttpServerRequest.fromWeb(
      new Request(web, { method: web.method, body: body.success }),
    );
    return yield* httpEffect.pipe(
      Effect.provideService(HttpServerRequest.HttpServerRequest, bounded),
      Effect.map(HttpServerResponse.setHeaders(apiHeaders)),
    );
  }),
);

const RpcHandlers = AppRpcs.toLayer({ Greet: ({ name }) => greet(name) });

// NOTE: The RPC server is built per request so no fibers, queues, or I/O
// outlive the Worker request that started them, and handlers see that
// request's services.
const rpcRoute = HttpRouter.add(
  "POST",
  RPC_PATH,
  Effect.scoped(Effect.flatten(RpcServer.toHttpEffect(AppRpcs))).pipe(
    Effect.provide(Layer.mergeAll(RpcHandlers, RpcSerialization.layerJson)),
  ),
).pipe(Layer.provide(RequestBounds.layer));

export const apiRoutes = Layer.mergeAll(
  HttpRouter.add(
    "GET",
    "/api/health",
    Effect.gen(function* () {
      const info = yield* AppInfo;
      return json(yield* info.read);
    }),
  ),
  rpcRoute,
  HttpRouter.add("*", "*", json({ error: "Not found" }, 404)),
);
