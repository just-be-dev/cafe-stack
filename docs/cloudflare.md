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
                                   │
                                   ├── domain services
                                   └── D1 / Durable Objects / AI, when added
```

The Website is a `Cloudflare.Website.Foldkit` with `env: { API: Api, BASE_PATH }` and `assets.runWorkerFirst: ["<base>api/*"]`, where the base path is `/` unless the app is deployed under a project path. The API is a `Cloudflare.Worker` that keeps Alchemy's default `workersDev: true`, which gives it a stable workers.dev URL and per-version preview URLs. `edge.ts` gets its env type from `Cloudflare.InferEnv<typeof App>` and only forwards requests to the binding, stripping the base path first. Routing and business logic live in the API.

Both Workers are public. When the product needs protected operations, enforce authentication and authorization in the API, since requests can arrive directly or through the Website.

Both Workers use compatibility date `2026-10-04`. When you move it, test the new date rather than relying on Cloudflare's default.

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

`src/platform/cloudflare/project.ts` reads optional environment variables at plan time. With none set, the stack is `project-starter`, served from `/`.

- `PROJECT_NAME` names the stack. Alchemy keys state and resource names by stack, so separate projects need separate names.
- `BASE_PATH` serves the app under a prefix such as `/<project>/`. It sets Vite's `base` and the `runWorkerFirst` pattern, and `edge.ts` strips it before forwarding. UI code must build URLs from `import.meta.env.BASE_URL`, not absolute `/` paths.
- With `STAGE=prod`, `PROJECT_NAME`, `PROJECTS_HOST`, and `PROJECTS_ZONE` set, the Website is routed at `<host>/<project>/*` and the stack returns that URL.

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

## References

- [Alchemy documentation index](https://alchemy.run/llms.txt). Append `.md` to any docs page URL for Markdown.
- `node_modules/alchemy/src`, the final word on the installed version.
- [Cloudflare Workers](https://developers.cloudflare.com/workers/), [Workers Observability](https://developers.cloudflare.com/workers/observability/), [Durable Objects](https://developers.cloudflare.com/durable-objects/), and [D1](https://developers.cloudflare.com/d1/).
