# Organization

The starter keeps the backend flat in `src/model.ts`, `src/service.ts`, `src/rpc.ts`, and `src/api.ts`, with Cloudflare code in `src/platform/cloudflare/` and the frontend in `src/ui/`. As the project grows, it can take roughly this shape. Create folders when there's code to put in them.

```text
alchemy.run.ts                     re-exports the platform stack
src/
  <domain>/
    model.ts                       Schema models, IDs, validation, errors
    rpc.ts                         RpcGroup contract shared with the UI
    service.ts                     capability contract, when one is needed
    application.ts                 complete use cases and composition
    store.ts                       shared persistence rules + memory implementation
    *.test.ts                      domain and application tests
  http/
    api.ts                         route composition
    <domain>.ts                    request/response adapters
    identity.ts                    request identity contract
    response.ts                    shared decoding and error responses
  platform/
    boundary.test.ts               dependency-direction check
    cloudflare/
      stack.ts                     Alchemy stack, Website, telemetry, state
      edge.ts                      Website entry that forwards to the API
      api.ts                       API Worker, telemetry, per-request layers
      database.ts                  D1 database declaration
      <domain>-d1.ts               D1 adapter
      <domain>-object.ts           Durable Object host
      identity.ts                  verified request identity extraction
  ui/
    AGENTS.md                      Foldkit conventions and upgrade steps
    entry.ts                       Runtime.makeApplication / Runtime.run
    main.ts                        root init, plus all definitions in a small app
    model.ts / message.ts          root Schema state and Messages
    command.ts / route.ts          root effects and URL mapping
    update/ / view/                split by area as the root grows
    page/<page>/                   page Submodels and their tests
    domain/                        pure UI/domain transformations
    api.ts / theme.ts              typed RPC client service and theme Flags
    lib/ / components/             shared leaves; foldcn copies in components/ui/
    styles.css                     Tailwind v4 and theme tokens
public/                            static assets and _headers
migrations/                        append-only D1 migrations
patches/                           Bun patches and their rationale
docs/                              architecture, API contracts, operations
```

## Dependency direction

```text
Cloudflare host ──→ HTTP/application ──→ domain models + capability contracts
       │                                      ▲
       └── selects adapters/layers ────────────┘

UI entry ──→ root ──→ page Submodels ──→ shared UI/domain leaves
```

HTTP code knows nothing about Cloudflare binding names or headers. The UI imports backend code only through the RPC contract and the models it uses; `boundary.test.ts` checks that too. Platform hosts provide the services it uses. Backend code imports from the owning domain directly. Add a barrel file when something consumes it, such as the frontend importing domain models.

Pages never import the root app; they talk to the parent through Messages and OutMessages. A small app can keep its pure definitions in `main.ts` and split `model`, `message`, and `command` out as they grow. Runtime boot always stays in `entry.ts` so tests can import definitions without starting the app.

Name domains after the product and document their invariants in `AGENTS.md`.

`boundary.test.ts` is a simple source-text check. It catches relative imports into `platform/`, the Alchemy, Cloudflare, and `agents` packages, and a list of Cloudflare global types. Extend it when you add backend path aliases, `.tsx` files, or other platform SDKs.
