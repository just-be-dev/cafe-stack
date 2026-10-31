# Cloudflare

Infrastructure is declared with Alchemy v2. The stack is an Effect program in `src/platform/cloudflare/stack.ts`, and `alchemy.run.ts` re-exports it.

## Topology

```text
Browser / client
          │
          ▼
Website (Cloudflare.Website.Foldkit) ── static assets
          │ <base>api/*, runWorkerFirst
          ▼
edge.ts ── service binding ── Api Worker ◀── direct client (workers.dev)
                                   │  GET /api/health, POST /api/rpc
                                   ├── domain services
                                   └── D1 / Durable Objects / AI, when added
```

The Website is a `Cloudflare.Website.Foldkit` with `env: { API: Api, BASE_PATH }` and `assets.runWorkerFirst: ["<base>api/*"]`, where the base path is `/` unless `BASE_PATH` sets a prefix. The API is a `Cloudflare.Worker` that keeps Alchemy's default `workersDev: true`, which gives it a stable workers.dev URL and per-version preview URLs. `edge.ts` gets its env type from `Cloudflare.InferEnv<typeof App>` and only forwards requests to the binding, stripping the base path first. Routing and business logic live in the API. The typed RPC endpoint, `POST /api/rpc`, needs no edge changes: it matches `<base>api/*` like any other API route, and the UI posts to `${import.meta.env.BASE_URL}api/rpc`.

Both Workers are public. When the product needs protected operations, enforce authentication and authorization in the API, since requests can arrive directly or through the Website.

Both Workers use compatibility date `2026-10-04`. When you move it, test the new date rather than relying on Cloudflare's default.

Both Workers also set `enable_request_signal` and `request_signal_passthrough`. The first makes `request.signal` abort when the client disconnects; it is experimental and has no default-on date. The second carries that signal to a subrequest when a Worker forwards the incoming request, which `edge.ts` does over the service binding, so a client abort can reach the API. What's verified and what isn't:

- Verified locally: both Workers boot with the flags under `alchemy dev`, and `/api/health` answers through the Website URL.
- Not verified: propagation itself. Under `alchemy dev`, a Bun proxy sits in front of each local Worker and doesn't pass client disconnects on, so `request.signal` never aborted locally, not even on direct requests to the API. Check it on a deployed preview stage.
- Alchemy's Effect bridge (`2.0.0-beta.83`) doesn't interrupt the handler fiber when the signal aborts, unlike Effect's own `HttpEffect.toWebHandler`. A handler that should stop work on abort has to read the raw request from `Cloudflare.Request` and listen to its `signal`.

Remove both flags if a Worker misbehaves around request cloning or cancellation.

## Telemetry

`stack.ts` turns on persisted invocation logs and traces for the Website. `api.ts` turns on persisted invocation logs and provides `Cloudflare.Telemetry({ headSamplingRate: 1, persist: true })` on the Worker's outer Effect. That layer adds the API's trace configuration at plan time and builds a fresh tracer for each invocation. Keep it on the Worker host, not on domain services or a runtime shared across requests.

`observability.traces` on its own records Cloudflare's platform spans. The Telemetry layer adds `Api.request` and any `Effect.withSpan` or `Effect.fn` spans to the same waterfall, next to platform operations like fetch and D1. It needs a compatibility date of `2026-07-28` or later. Don't set `observability.traces` explicitly on the API; an explicit setting overrides what the layer contributes.

Sampling is `1` (every request) with dashboard persistence. When traffic grows, tune the Website's logs and traces, the API's logs, and the API's Telemetry layer together.

To check it after a deploy, request `/api/health` and open each Worker under **Workers & Pages → Observability**. You should see an API invocation with an `Api.request` span. Requests served entirely from static assets skip the edge handler. Native tracing forwards scalar span attributes and completion status; span events, links, and structured attributes are dropped.

Keep secrets, auth headers, request and response bodies, and entity data out of logs and spans. Use stable operation names and harmless attributes. Check what request metadata Cloudflare collects and how long it keeps it before you handle personal data.

## Plan time and runtime

Worker and Durable Object declarations run in two phases:

| Phase                                | Use it for                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Outer Effect: plan time / cold start | Declaring bindings and namespaces, choosing resources, building layers                              |
| Returned handler / instance Effect   | Storage operations, raw AI binding calls, durable callbacks, request headers, runtime-bound methods |

Plan time runs under Bun and imports everything reachable from `alchemy.run.ts`. A module that loads `cloudflare:*` at the top level breaks that, so acquire native capabilities inside the runtime phase.

A D1 adapter can grab its database binding in the outer Effect and return a layer that requires `Alchemy.RuntimeContext`. Provide that layer per request or per instance, where the context exists. The service methods capture the context, so callers get a portable capability.

## Local and deployed state

`alchemy dev` uses stage `dev_$USER` with local Workers, Durable Object, and D1 data. `stack.ts` picks `Alchemy.localState()` in dev and `Cloudflare.state()` for deployed stages based on `Alchemy.ALCHEMY_DEV`. Local resource state has to sit next to the checkout's local database. If it were shared, a fresh worktree's empty database could be marked as already migrated.

Run `mise run dev` from the repo root and use the Website URL it prints; the port isn't fixed. Workers AI calls are real remote requests even in local dev and need credentials.

To deploy, add a Cloudflare profile with `mise run cloudflare:profile` or select one with `ALCHEMY_PROFILE`. The first deploy may offer to create Alchemy's Cloudflare-hosted state store. That changes shared infrastructure, so get approval first.

## Deploy settings

`stack.ts` reads optional environment variables at plan time with Effect `Config`. The [README](../README.md#environment-variables) lists them.

`BASE_PATH` sets Vite's `base` and the `runWorkerFirst` pattern, and `edge.ts` strips it before forwarding, so `/app/api/health` reaches the API as `/api/health`.

## Identity and authorization

When the product needs protected data, pick an authentication scheme. Don't assume forwarded requests carry a verified identity.

Turn verified identity into a platform-independent, request-scoped service and check authorization inside application operations. Treat a missing identity as unauthenticated. Knowing who someone is and deciding what they can do are separate jobs.

`public/_headers` sets the CSP for static assets. Set security headers for API responses in the API itself. Keep the deployed CSP strict even if the dev server needs something looser.

## Adding persistence and durable work

- D1: declare `Cloudflare.D1.Database` with `migrations: "./migrations"`. Alchemy tracks applied migrations by hash in `__alchemy_migrations`, so add new numbered files and leave applied ones alone.
- Durable Objects: use them for instance-local storage, coordination, or durable callbacks. Keep the host class thin and call into domain code.
- `Alchemy.makeCallback` delivers at least once. Callback names and payloads, schedule keys, storage keys, and replay journal names all become stored contracts. Make callbacks idempotent before shipping.
- If a state write and a schedule must be atomic, expose one host capability that owns that transaction and test it on the native implementation. Separate D1 and Durable Object stores can't share a transaction.
- Deterministic replay rebuilds working values from its journal. Network calls go in journaled Activities.

## Optional: SSR and prerendering

The Website serves a client-rendered Foldkit app from static assets. Foldkit's Vite plugin can also render pages on the server: `foldkit({ ssr: { serverEntry, clientEntry, build } })` takes a server entry such as `src/ui/entry.server.ts` that exports `renderPage` and `renderDocument`, built with `Server` from `foldkit/experimental`. `build: { prerender: true }` writes static HTML for the paths the entry exports as `prerenderPaths`. The client entry then calls `Runtime.hydrate` instead of `Runtime.run`, and the source tree drops `index.html`. See `examples/ssr` and `examples/ssg` in the Foldkit repository (`repos/foldkit/` after `mise run foldkit:source`).

This is a variant, not the default. Prerendered pages can still ship as assets. Rendering at request time needs the Website Worker to run the server bundle for page requests instead of only forwarding `/api/*`, which changes `edge.ts` and `runWorkerFirst` and adds hydration checks. Plan it as its own change.

## References

- [Alchemy documentation index](https://alchemy.run/llms.txt). Append `.md` to any docs page URL for Markdown.
- `node_modules/alchemy/src`, the final word on the installed version.
- [Cloudflare Workers](https://developers.cloudflare.com/workers/), [Workers Observability](https://developers.cloudflare.com/workers/observability/), [Durable Objects](https://developers.cloudflare.com/durable-objects/), and [D1](https://developers.cloudflare.com/d1/).
